import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // All / Unread / Campaign tabs
  filter: z.enum(["all", "unread", "campaign"]).default("all"),
  status: z.enum(["open", "closed"]).optional(),
  assigned: z.enum(["me", "unassigned"]).optional(),
  search: z.string().trim().max(100).optional()
});

export const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  // Id of the oldest message you already have; returns the ones before it
  before: objectId.optional()
});

export const replySchema = z.object({
  text: z.string().trim().min(1, "Message text is required").max(4096),
  replyToWamid: z.string().trim().max(200).optional()
});

export const templateSendSchema = z.object({
  templateId: objectId,
  variables: z.array(z.string().trim().max(200)).max(20).default([]),
  headerMediaUrl: z.string().url().max(2000).optional()
});

export const startConversationSchema = templateSendSchema.extend({
  phone: z.string().trim().min(1, "Phone number is required").max(20),
  name: z.string().trim().max(100).optional()
});

export const updateConversationSchema = z
  .object({
    status: z.enum(["open", "closed"]).optional(),
    // null = unassign
    assignedTo: objectId.nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Send at least one field to update"
  });

export const readSchema = z.object({
  // Also tell WhatsApp the customer's messages were read (blue ticks on their phone)
  notifyCustomer: z.boolean().default(true)
});
