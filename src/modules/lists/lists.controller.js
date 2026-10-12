import { z } from "zod";

import {
  listLists,
  getList,
  createList,
  updateList,
  deleteList,
  getListContacts,
  addContactsToList,
  removeContactFromList,
  importCsvIntoList
} from "./lists.service.js";

const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional()
});

const createListSchema = z.object({
  name: z.string().trim().min(1, "List name is required").max(100),
  description: z.string().trim().max(300).default("")
});

const updateListSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(300).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Send at least one field to update"
  });

const addContactsSchema = z.object({
  contactIds: z.array(z.string()).min(1, "Send at least one contact id").max(5000)
});

export async function getLists(req, res, next) {
  try {
    const query = pagingSchema.parse(req.query);
    const data = await listLists(req.organization._id, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getOneList(req, res, next) {
  try {
    const list = await getList(req.organization._id, req.params.id);
    res.status(200).json({ success: true, data: { list } });
  } catch (error) {
    next(error);
  }
}

export async function addList(req, res, next) {
  try {
    const data = createListSchema.parse(req.body);
    const list = await createList(req.organization._id, req.user._id, data);

    res.status(201).json({
      success: true,
      message: "List created",
      data: { list }
    });
  } catch (error) {
    next(error);
  }
}

export async function editList(req, res, next) {
  try {
    const data = updateListSchema.parse(req.body);
    const list = await updateList(req.organization._id, req.params.id, data);

    res.status(200).json({
      success: true,
      message: "List updated",
      data: { list }
    });
  } catch (error) {
    next(error);
  }
}

export async function removeList(req, res, next) {
  try {
    await deleteList(req.organization._id, req.params.id);
    res.status(200).json({ success: true, message: "List deleted" });
  } catch (error) {
    next(error);
  }
}

export async function getContactsInList(req, res, next) {
  try {
    const query = pagingSchema.parse(req.query);
    const data = await getListContacts(
      req.organization._id,
      req.params.id,
      query
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function addContacts(req, res, next) {
  try {
    const { contactIds } = addContactsSchema.parse(req.body);
    const result = await addContactsToList(
      req.organization._id,
      req.params.id,
      contactIds
    );

    res.status(200).json({
      success: true,
      message: `${result.added} contacts added to the list`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function removeContact(req, res, next) {
  try {
    await removeContactFromList(
      req.organization._id,
      req.params.id,
      req.params.contactId
    );
    res.status(200).json({
      success: true,
      message: "Contact removed from the list"
    });
  } catch (error) {
    next(error);
  }
}

export async function importIntoList(req, res, next) {
  try {
    if (!req.file) {
      const error = new Error('Upload a CSV file in the "file" field');
      error.statusCode = 400;
      throw error;
    }

    const result = await importCsvIntoList(
      req.organization._id,
      req.user._id,
      req.params.id,
      req.file.buffer
    );

    res.status(200).json({
      success: true,
      message: `${result.addedToList} contacts added to the list`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}