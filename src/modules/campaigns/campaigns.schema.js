
import { z } from "zod";
import { CAMPAIGN_STATUSES } from "../../models/Campaign.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const isoDate = z.string().datetime({
  offset: true,
  message: "Use an ISO date, e.g. 2026-10-20T09:30:00+05:30"
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional()
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateId: objectId,
  listId: objectId.optional(),
  contactIds: z.array(objectId).max(10000).optional(),
  variables: z.array(z.string().trim().max(200)).max(20).default([]),
  headerMediaUrl: z.string().url().max(2000).optional(),
  scheduledAt: isoDate.optional(),
  startNow: z.boolean().default(false)
}).refine(
  (data) => !(data.scheduledAt && data.startNow),
  {
    message: "Use either scheduledAt or startNow, not both",
    path: ["scheduledAt"]
  }
);

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  variables: z.array(z.string().trim().max(200)).max(20).optional(),
  headerMediaUrl: z.string().url().max(2000).nullable().optional(),
  scheduledAt: isoDate.nullable().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "Send at least one field to update" }
);

export const addRecipientsSchema = z.object({
  listId: objectId.optional(),
  contactIds: z.array(objectId).min(1).max(10000).optional()
}).refine(
  (data) => Boolean(data.listId || data.contactIds?.length),
  { message: "Send listId or contactIds" }
);

export const recipientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum([
    "PENDING",
    "PROCESSING",
    "SENT",
    "FAILED",
    "SKIPPED"
  ]).optional()
});

export const messagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum([
    "PENDING",
    "SKIPPED",
    "QUEUED",
    "SENT",
    "DELIVERED",
    "READ",
    "FAILED"
  ]).optional()
});
