import { z } from "zod";

export const listAutomationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional()
});

export const createAutomationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  triggerType: z.literal("KEYWORD").default("KEYWORD"),
  triggerValue: z.string().trim().min(1).max(200),
  replyText: z.string().trim().min(1).max(4096),
  isActive: z.boolean().default(true)
});

export const updateAutomationSchema = createAutomationSchema.partial();