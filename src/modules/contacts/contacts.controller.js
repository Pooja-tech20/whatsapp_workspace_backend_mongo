import { z } from "zod";

import {
  listContacts,
  createContact,
  deleteContact,
  importContactsFromCsv
} from "./contacts.service.js";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional()
});

const createContactSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required").max(20),
  firstName: z.string().trim().max(100).default(""),
  lastName: z.string().trim().max(100).default("")
});

export async function getContacts(req, res, next) {
  try {
    const query = listQuerySchema.parse(req.query);
    const data = await listContacts(req.organization._id, query);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function addContact(req, res, next) {
  try {
    const data = createContactSchema.parse(req.body);
    const contact = await createContact(
      req.organization._id,
      req.user._id,
      data
    );

    res.status(201).json({
      success: true,
      message: "Contact saved",
      data: { contact }
    });
  } catch (error) {
    next(error);
  }
}

export async function removeContact(req, res, next) {
  try {
    await deleteContact(req.organization._id, req.params.id);

    res.status(200).json({ success: true, message: "Contact deleted" });
  } catch (error) {
    next(error);
  }
}

export async function importContacts(req, res, next) {
  try {
    if (!req.file) {
      const error = new Error('Upload a CSV file in the "file" field');
      error.statusCode = 400;
      throw error;
    }

    const result = await importContactsFromCsv(
      req.organization._id,
      req.user._id,
      req.file.buffer
    );

    res.status(200).json({
      success: true,
      message: `${result.imported} contacts imported`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}