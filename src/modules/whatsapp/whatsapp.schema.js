import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const variablesSchema = z
  .array(z.union([z.string(), z.number()]).transform((v) => String(v)))
  .max(20)
  .default([]);

// POST /whatsapp/test-message
// Either a template ("type": "template") or a free-text reply ("type": "text")
export const sendMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("template"),
    to: z.string().trim().min(8, "Phone number is required"),
    templateId: objectId,
    variables: variablesSchema,
    headerMediaUrl: z.string().url().optional()
  }),
  z.object({
    type: z.literal("text"),
    to: z.string().trim().min(8, "Phone number is required"),
    text: z.string().trim().min(1, "Message text is required").max(4096)
  })
]);
