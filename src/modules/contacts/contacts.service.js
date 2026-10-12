// import mongoose from "mongoose";
// import { parse } from "csv-parse/sync";

// import Contact from "../../models/Contact.js";
// import { normalizePhone, buildFullName } from "../../utils/phone.js";

// const MAX_IMPORT_ROWS = 20000;
// const MAX_REPORTED_ERRORS = 20;

// function httpError(message, statusCode) {
//   const error = new Error(message);
//   error.statusCode = statusCode;
//   return error;
// }

// function escapeRegex(value) {
//   return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// export function toContactDto(contact) {
//   return {
//     id: contact._id,
//     name: contact.name,
//     firstName: contact.firstName,
//     lastName: contact.lastName,
//     phone: contact.phone,
//     source: contact.source,
//     status: contact.status,
//     createdAt: contact.createdAt
//   };
// }

// /* ------------------------------ LIST ------------------------------ */

// export async function listContacts(organizationId, { page, limit, search }) {
//   const filter = { organizationId };

//   if (search) {
//     const pattern = new RegExp(escapeRegex(search), "i");
//     filter.$or = [
//       { name: pattern },
//       { phone: pattern },
//       { source: pattern }
//     ];
//   }

//   const [contacts, total] = await Promise.all([
//     Contact.find(filter)
//       .sort({ createdAt: -1, _id: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean(),
//     Contact.countDocuments(filter)
//   ]);

//   return {
//     contacts: contacts.map(toContactDto),
//     pagination: {
//       page,
//       limit,
//       total,
//       totalPages: Math.max(1, Math.ceil(total / limit))
//     }
//   };
// }

// /* ------------------------------ CREATE ------------------------------ */

// export async function createContact(organizationId, userId, data) {
//   const phone = normalizePhone(data.phone);

//   if (!phone) {
//     throw httpError("Enter a valid phone number", 400);
//   }

//   try {
//     const contact = await Contact.create({
//       organizationId,
//       createdBy: userId,
//       phone,
//       firstName: data.firstName,
//       lastName: data.lastName,
//       name: buildFullName(data.firstName, data.lastName),
//       source: "manual"
//     });

//     return toContactDto(contact);
//   } catch (error) {
//     if (error.code === 11000) {
//       throw httpError("This phone number is already in your contacts", 409);
//     }
//     throw error;
//   }
// }

// /* ------------------------------ DELETE ------------------------------ */

// export async function deleteContact(organizationId, contactId) {
//   if (!mongoose.isValidObjectId(contactId)) {
//     throw httpError("Invalid contact id", 400);
//   }

//   const deleted = await Contact.findOneAndDelete({
//     _id: contactId,
//     organizationId
//   });

//   if (!deleted) {
//     throw httpError("Contact not found", 404);
//   }
// }

// /* ------------------------------ CSV IMPORT ------------------------------ */

// const HEADER_ALIASES = {
//   phone: ["phone", "phonenumber", "mobile", "mobilenumber", "number", "whatsapp", "whatsappnumber", "contact", "contactnumber"],
//   firstName: ["firstname", "first", "fname"],
//   lastName: ["lastname", "last", "lname", "surname"],
//   name: ["name", "fullname", "customer", "customername"]
// };

// function normalizeHeader(header) {
//   return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
// }

// function pick(row, field) {
//   for (const alias of HEADER_ALIASES[field]) {
//     if (row[alias] !== undefined && String(row[alias]).trim() !== "") {
//       return String(row[alias]).trim();
//     }
//   }
//   return "";
// }

// // Pure function (easy to test): CSV buffer -> [{ phone, firstName, lastName }]
// export function parseContactsCsv(buffer) {
//   let rows;

//   try {
//     rows = parse(buffer, {
//       columns: (headers) => headers.map(normalizeHeader),
//       bom: true,
//       skip_empty_lines: true,
//       trim: true,
//       relax_column_count: true
//     });
//   } catch (error) {
//     throw httpError(`Could not read CSV: ${error.message}`, 400);
//   }

//   if (rows.length === 0) {
//     throw httpError("The CSV file has no rows", 400);
//   }

//   if (rows.length > MAX_IMPORT_ROWS) {
//     throw httpError(`CSV has too many rows (max ${MAX_IMPORT_ROWS})`, 400);
//   }

//   const hasPhoneColumn = HEADER_ALIASES.phone.some((alias) => alias in rows[0]);
//   if (!hasPhoneColumn) {
//     throw httpError(
//       "CSV must have a phone column (e.g. phone, mobile, number, whatsapp)",
//       400
//     );
//   }

//   return rows.map((row) => {
//     let firstName = pick(row, "firstName");
//     let lastName = pick(row, "lastName");

//     // Only a single "name" column: split on the first space
//     if (!firstName && !lastName) {
//       const fullName = pick(row, "name");
//       const [first, ...rest] = fullName.split(/\s+/).filter(Boolean);
//       firstName = first || "";
//       lastName = rest.join(" ");
//     }

//     return { phone: pick(row, "phone"), firstName, lastName };
//   });
// }

// export async function importContactsFromCsv(organizationId, userId, buffer) {
//   const rows = parseContactsCsv(buffer);

//   const errors = [];
//   const summary = {
//     total: rows.length,
//     imported: 0,
//     duplicates: 0,
//     invalid: 0
//   };

//   const reportError = (row, phone, reason) => {
//     if (errors.length < MAX_REPORTED_ERRORS) {
//       errors.push({ row, phone, reason });
//     }
//   };

//   // 1) Validate + dedupe inside the file
//   const seen = new Set();
//   const candidates = [];

//   rows.forEach((row, index) => {
//     const rowNumber = index + 2; // +1 for header, +1 for 1-based rows
//     const phone = normalizePhone(row.phone);

//     if (!phone) {
//       summary.invalid += 1;
//       reportError(rowNumber, row.phone, "Invalid phone number");
//       return;
//     }

//     if (seen.has(phone)) {
//       summary.duplicates += 1;
//       reportError(rowNumber, row.phone, "Duplicate inside the file");
//       return;
//     }

//     seen.add(phone);
//     candidates.push({ rowNumber, phone, ...row });
//   });

//   // 2) Skip numbers that already exist in this organization
//   const existing = await Contact.find({
//     organizationId,
//     phone: { $in: candidates.map((c) => c.phone) }
//   })
//     .select("phone")
//     .lean();

//   const existingPhones = new Set(existing.map((c) => c.phone));
//   const toInsert = [];

//   for (const candidate of candidates) {
//     if (existingPhones.has(candidate.phone)) {
//       summary.duplicates += 1;
//       reportError(candidate.rowNumber, candidate.phone, "Already in your contacts");
//       continue;
//     }

//     toInsert.push({
//       organizationId,
//       createdBy: userId,
//       phone: candidate.phone,
//       firstName: candidate.firstName,
//       lastName: candidate.lastName,
//       name: buildFullName(candidate.firstName, candidate.lastName),
//       source: "csv"
//     });
//   }

//   // 3) Bulk insert
//   if (toInsert.length > 0) {
//     try {
//       await Contact.insertMany(toInsert, { ordered: false });
//       summary.imported = toInsert.length;
//     } catch (error) {
//       // Race condition: some rows hit the unique index after our check
//       const failed = error.writeErrors?.length;
//       if (failed === undefined) throw error;

//       summary.imported = toInsert.length - failed;
//       summary.duplicates += failed;
//     }
//   }

//   return { ...summary, errors };
// }

import mongoose from "mongoose";
import { parse } from "csv-parse/sync";

import Contact from "../../models/Contact.js";
import ListMember from "../../models/ListMember.js";
import { normalizePhone, buildFullName } from "../../utils/phone.js";

const MAX_IMPORT_ROWS = 20000;
const MAX_REPORTED_ERRORS = 20;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toContactDto(contact) {
  return {
    id: contact._id,
    name: contact.name,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    source: contact.source,
    status: contact.status,
    createdAt: contact.createdAt
  };
}

/* ------------------------------ LIST ------------------------------ */

export async function listContacts(organizationId, { page, limit, search }) {
  const filter = { organizationId };

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { name: pattern },
      { phone: pattern },
      { source: pattern }
    ];
  }

  const [contacts, total] = await Promise.all([
    Contact.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Contact.countDocuments(filter)
  ]);

  return {
    contacts: contacts.map(toContactDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

/* ------------------------------ CREATE ------------------------------ */

export async function createContact(organizationId, userId, data) {
  const phone = normalizePhone(data.phone);

  if (!phone) {
    throw httpError("Enter a valid phone number", 400);
  }

  try {
    const contact = await Contact.create({
      organizationId,
      createdBy: userId,
      phone,
      firstName: data.firstName,
      lastName: data.lastName,
      name: buildFullName(data.firstName, data.lastName),
      source: "manual"
    });

    return toContactDto(contact);
  } catch (error) {
    if (error.code === 11000) {
      throw httpError("This phone number is already in your contacts", 409);
    }
    throw error;
  }
}

/* ------------------------------ DELETE ------------------------------ */

export async function deleteContact(organizationId, contactId) {
  if (!mongoose.isValidObjectId(contactId)) {
    throw httpError("Invalid contact id", 400);
  }

  const deleted = await Contact.findOneAndDelete({
    _id: contactId,
    organizationId
  });

  if (!deleted) {
    throw httpError("Contact not found", 404);
  }

  // Remove the contact from every list it belonged to
  await ListMember.deleteMany({ organizationId, contactId: deleted._id });
}

/* ------------------------------ CSV IMPORT ------------------------------ */

const HEADER_ALIASES = {
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "number", "whatsapp", "whatsappnumber", "contact", "contactnumber"],
  firstName: ["firstname", "first", "fname"],
  lastName: ["lastname", "last", "lname", "surname"],
  name: ["name", "fullname", "customer", "customername"]
};

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row, field) {
  for (const alias of HEADER_ALIASES[field]) {
    if (row[alias] !== undefined && String(row[alias]).trim() !== "") {
      return String(row[alias]).trim();
    }
  }
  return "";
}

// Pure function (easy to test): CSV buffer -> [{ phone, firstName, lastName }]
export function parseContactsCsv(buffer) {
  let rows;

  try {
    rows = parse(buffer, {
      columns: (headers) => headers.map(normalizeHeader),
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
  } catch (error) {
    throw httpError(`Could not read CSV: ${error.message}`, 400);
  }

  if (rows.length === 0) {
    throw httpError("The CSV file has no rows", 400);
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw httpError(`CSV has too many rows (max ${MAX_IMPORT_ROWS})`, 400);
  }

  const hasPhoneColumn = HEADER_ALIASES.phone.some((alias) => alias in rows[0]);
  if (!hasPhoneColumn) {
    throw httpError(
      "CSV must have a phone column (e.g. phone, mobile, number, whatsapp)",
      400
    );
  }

  return rows.map((row) => {
    let firstName = pick(row, "firstName");
    let lastName = pick(row, "lastName");

    // Only a single "name" column: split on the first space
    if (!firstName && !lastName) {
      const fullName = pick(row, "name");
      const [first, ...rest] = fullName.split(/\s+/).filter(Boolean);
      firstName = first || "";
      lastName = rest.join(" ");
    }

    return { phone: pick(row, "phone"), firstName, lastName };
  });
}

export async function importContactsFromCsv(organizationId, userId, buffer) {
  const rows = parseContactsCsv(buffer);

  const errors = [];
  const summary = {
    total: rows.length,
    imported: 0,
    duplicates: 0,
    invalid: 0
  };

  const reportError = (row, phone, reason) => {
    if (errors.length < MAX_REPORTED_ERRORS) {
      errors.push({ row, phone, reason });
    }
  };

  // 1) Validate + dedupe inside the file
  const seen = new Set();
  const candidates = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-based rows
    const phone = normalizePhone(row.phone);

    if (!phone) {
      summary.invalid += 1;
      reportError(rowNumber, row.phone, "Invalid phone number");
      return;
    }

    if (seen.has(phone)) {
      summary.duplicates += 1;
      reportError(rowNumber, row.phone, "Duplicate inside the file");
      return;
    }

    seen.add(phone);
    candidates.push({ rowNumber, phone, ...row });
  });

  // 2) Skip numbers that already exist in this organization
  const existing = await Contact.find({
    organizationId,
    phone: { $in: candidates.map((c) => c.phone) }
  })
    .select("phone")
    .lean();

  const existingPhones = new Set(existing.map((c) => c.phone));
  const toInsert = [];

  for (const candidate of candidates) {
    if (existingPhones.has(candidate.phone)) {
      summary.duplicates += 1;
      reportError(candidate.rowNumber, candidate.phone, "Already in your contacts");
      continue;
    }

    toInsert.push({
      organizationId,
      createdBy: userId,
      phone: candidate.phone,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      name: buildFullName(candidate.firstName, candidate.lastName),
      source: "csv"
    });
  }

  // 3) Bulk insert
  if (toInsert.length > 0) {
    try {
      await Contact.insertMany(toInsert, { ordered: false });
      summary.imported = toInsert.length;
    } catch (error) {
      // Race condition: some rows hit the unique index after our check
      const failed = error.writeErrors?.length;
      if (failed === undefined) throw error;

      summary.imported = toInsert.length - failed;
      summary.duplicates += failed;
    }
  }

  return { ...summary, errors };
}