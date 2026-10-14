
import { z } from "zod";

import {
  getReportTypes as types,
  getAnalyticsFilters as filters,
  listReports as list,
  createReport as create,
  getReport as get,
  updateReport as update,
  deleteReport as remove,
  executeReport,
  runReportCsv
} from "./analytics.service.js";

const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid report ID");

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["MESSAGE_LEVEL", "MESSAGE_SUMMARY"]),
  filters: z.object({
    tz: z.string().max(80).optional(),
    range: z.enum(["today", "3h", "24h", "7d", "30d", "90d"]),
    status: z.string().max(300).optional()
  }),
  isRecurring: z.boolean().optional().default(false),
  frequency: z.enum(["WEEKLY"]).optional()
});

const listSchema = z.object({
  tab: z.enum(["all", "recurring"]).optional().default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export async function getTypes(req, res, next) {
  try {
    res.json({ success: true, data: types() });
  } catch (e) { next(e); }
}

export async function getFilters(req, res, next) {
  try {
    res.json({ success: true, data: filters() });
  } catch (e) { next(e); }
}

export async function getReports(req, res, next) {
  try {
    const query = listSchema.parse(req.query);
    const result = await list(req.organization._id, query);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function postReport(req, res, next) {
  try {
    const input = createSchema.parse(req.body);
    const report = await create(req.organization._id, req.user._id, input);
    res.status(201).json({ success: true, data: { report } });
  } catch (e) { next(e); }
}

export async function getOneReport(req, res, next) {
  try {
    const id = idSchema.parse(req.params.id);
    const report = await get(req.organization._id, id);
    res.json({ success: true, data: { report } });
  } catch (e) { next(e); }
}

export async function patchReport(req, res, next) {
  try {
    const id = idSchema.parse(req.params.id);
    const input = updateSchema.parse(req.body);
    const report = await update(req.organization._id, id, input);
    res.json({ success: true, data: { report } });
  } catch (e) { next(e); }
}

export async function deleteReport(req, res, next) {
  try {
    const id = idSchema.parse(req.params.id);
    await remove(req.organization._id, id);
    res.json({ success: true, message: "Report deleted" });
  } catch (e) { next(e); }
}

export async function runReport(req, res, next) {
  try {
    const id = idSchema.parse(req.params.id);

    if (req.query.format === "csv") {
      const file = await runReportCsv(req.organization._id, id);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.filename}"`
      );
      return res.status(200).send(file.csv);
    }

    const output = await executeReport(req.organization._id, id);
    res.json({ success: true, data: output });
  } catch (e) { next(e); }
}
