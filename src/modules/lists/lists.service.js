import mongoose from "mongoose";

import List from "../../models/List.js";
import ListMember from "../../models/ListMember.js";
import Contact from "../../models/Contact.js";
import { normalizePhone, buildFullName } from "../../utils/phone.js";
import { parseContactsCsv } from "../contacts/contacts.service.js";

const MAX_REPORTED_ERRORS = 20;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertValidId(id, label = "id") {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(`Invalid ${label}`, 400);
  }
}

function toListDto(list, contactCount = 0) {
  return {
    id: list._id,
    name: list.name,
    description: list.description,
    contactCount,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt
  };
}

async function findListOrFail(organizationId, listId) {
  assertValidId(listId, "list id");

  const list = await List.findOne({ _id: listId, organizationId }).lean();
  if (!list) throw httpError("List not found", 404);

  return list;
}

async function countMembers(organizationId, listIds) {
  if (listIds.length === 0) return new Map();

  const rows = await ListMember.aggregate([
    { $match: { organizationId, listId: { $in: listIds } } },
    { $group: { _id: "$listId", count: { $sum: 1 } } }
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
}

/* ------------------------------ LISTS ------------------------------ */

export async function listLists(organizationId, { page, limit, search }) {
  const filter = { organizationId };
  if (search) filter.name = new RegExp(escapeRegex(search), "i");

  const [lists, total] = await Promise.all([
    List.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    List.countDocuments(filter)
  ]);

  const counts = await countMembers(
    organizationId,
    lists.map((list) => list._id)
  );

  return {
    lists: lists.map((list) =>
      toListDto(list, counts.get(String(list._id)) || 0)
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

export async function getList(organizationId, listId) {
  const list = await findListOrFail(organizationId, listId);
  const counts = await countMembers(organizationId, [list._id]);

  return toListDto(list, counts.get(String(list._id)) || 0);
}

export async function createList(organizationId, userId, data) {
  try {
    const list = await List.create({
      organizationId,
      createdBy: userId,
      name: data.name,
      description: data.description
    });

    return toListDto(list, 0);
  } catch (error) {
    if (error.code === 11000) {
      throw httpError("A list with this name already exists", 409);
    }
    throw error;
  }
}

export async function updateList(organizationId, listId, data) {
  assertValidId(listId, "list id");

  try {
    const list = await List.findOneAndUpdate(
      { _id: listId, organizationId },
      { $set: data },
      { new: true, runValidators: true }
    ).lean();

    if (!list) throw httpError("List not found", 404);

    const counts = await countMembers(organizationId, [list._id]);
    return toListDto(list, counts.get(String(list._id)) || 0);
  } catch (error) {
    if (error.code === 11000) {
      throw httpError("A list with this name already exists", 409);
    }
    throw error;
  }
}

export async function deleteList(organizationId, listId) {
  assertValidId(listId, "list id");

  const deleted = await List.findOneAndDelete({
    _id: listId,
    organizationId
  });

  if (!deleted) throw httpError("List not found", 404);

  // Contacts themselves are kept; only the memberships are removed
  await ListMember.deleteMany({ organizationId, listId: deleted._id });
}

/* ------------------------------ MEMBERS ------------------------------ */

// Adds contacts to a list, skipping ones already inside. Returns counts.
async function addMembers(organizationId, listId, contactIds) {
  if (contactIds.length === 0) return { added: 0, alreadyInList: 0 };

  const existing = await ListMember.find({
    listId,
    contactId: { $in: contactIds }
  })
    .select("contactId")
    .lean();

  const existingIds = new Set(existing.map((m) => String(m.contactId)));
  const docs = contactIds
    .filter((id) => !existingIds.has(String(id)))
    .map((contactId) => ({ organizationId, listId, contactId }));

  let added = docs.length;

  if (docs.length > 0) {
    try {
      await ListMember.insertMany(docs, { ordered: false });
    } catch (error) {
      const failed = error.writeErrors?.length;
      if (failed === undefined) throw error;
      added = docs.length - failed;
    }
  }

  return { added, alreadyInList: contactIds.length - added };
}

export async function getListContacts(
  organizationId,
  listId,
  { page, limit, search }
) {
  const list = await findListOrFail(organizationId, listId);

  const contactMatch = {};
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    contactMatch.$or = [{ "contact.name": pattern }, { "contact.phone": pattern }];
  }

  const [result] = await ListMember.aggregate([
    { $match: { organizationId, listId: list._id } },
    {
      $lookup: {
        from: Contact.collection.name,
        localField: "contactId",
        foreignField: "_id",
        as: "contact"
      }
    },
    { $unwind: "$contact" },
    { $match: contactMatch },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        rows: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "count" }]
      }
    }
  ]);

  const total = result?.total[0]?.count || 0;

  return {
    list: { id: list._id, name: list.name },
    contacts: (result?.rows || []).map((row) => ({
      id: row.contact._id,
      name: row.contact.name,
      firstName: row.contact.firstName,
      lastName: row.contact.lastName,
      phone: row.contact.phone,
      source: row.contact.source,
      status: row.contact.status,
      addedToListAt: row.createdAt
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

export async function addContactsToList(organizationId, listId, rawIds) {
  const list = await findListOrFail(organizationId, listId);

  const ids = [...new Set(rawIds.map(String))];
  ids.forEach((id) => assertValidId(id, "contact id"));

  const found = await Contact.find({
    _id: { $in: ids },
    organizationId
  })
    .select("_id")
    .lean();

  const { added, alreadyInList } = await addMembers(
    organizationId,
    list._id,
    found.map((c) => c._id)
  );

  return {
    requested: ids.length,
    added,
    alreadyInList,
    notFound: ids.length - found.length
  };
}

export async function removeContactFromList(organizationId, listId, contactId) {
  const list = await findListOrFail(organizationId, listId);
  assertValidId(contactId, "contact id");

  const removed = await ListMember.findOneAndDelete({
    organizationId,
    listId: list._id,
    contactId
  });

  if (!removed) throw httpError("Contact is not in this list", 404);
}

/* ------------------------------ CSV IMPORT INTO A LIST ------------------------------ */

export async function importCsvIntoList(organizationId, userId, listId, buffer) {
  const list = await findListOrFail(organizationId, listId);
  const rows = parseContactsCsv(buffer);

  const errors = [];
  const summary = {
    total: rows.length,
    invalid: 0,
    duplicatesInFile: 0,
    newContacts: 0,
    existingContacts: 0,
    addedToList: 0,
    alreadyInList: 0
  };

  const reportError = (row, phone, reason) => {
    if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row, phone, reason });
  };

  // 1) Validate + dedupe inside the file
  const seen = new Set();
  const candidates = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const phone = normalizePhone(row.phone);

    if (!phone) {
      summary.invalid += 1;
      reportError(rowNumber, row.phone, "Invalid phone number");
      return;
    }
    if (seen.has(phone)) {
      summary.duplicatesInFile += 1;
      reportError(rowNumber, row.phone, "Duplicate inside the file");
      return;
    }

    seen.add(phone);
    candidates.push({ phone, ...row });
  });

  const phones = candidates.map((c) => c.phone);

  // 2) Create contacts that do not exist yet
  const existing = await Contact.find({
    organizationId,
    phone: { $in: phones }
  })
    .select("phone")
    .lean();

  const existingPhones = new Set(existing.map((c) => c.phone));
  summary.existingContacts = existingPhones.size;

  const toInsert = candidates
    .filter((c) => !existingPhones.has(c.phone))
    .map((c) => ({
      organizationId,
      createdBy: userId,
      phone: c.phone,
      firstName: c.firstName,
      lastName: c.lastName,
      name: buildFullName(c.firstName, c.lastName),
      source: "list"
    }));

  summary.newContacts = toInsert.length;

  if (toInsert.length > 0) {
    try {
      await Contact.insertMany(toInsert, { ordered: false });
    } catch (error) {
      const failed = error.writeErrors?.length;
      if (failed === undefined) throw error;
      summary.newContacts = toInsert.length - failed;
      summary.existingContacts += failed;
    }
  }

  // 3) Put every contact from the file into the list
  const all = await Contact.find({ organizationId, phone: { $in: phones } })
    .select("_id")
    .lean();

  const { added, alreadyInList } = await addMembers(
    organizationId,
    list._id,
    all.map((c) => c._id)
  );

  summary.addedToList = added;
  summary.alreadyInList = alreadyInList;

  return { ...summary, errors };
}
