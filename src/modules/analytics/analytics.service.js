
import mongoose from "mongoose";
import SavedReport from "../../models/SavedReport.js";
import Message from "../../models/Message.js";

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const REPORT_TYPES = [
  {
    value: "MESSAGE_LEVEL",
    label: "Message-level report",
    description: "Export individual message records and their delivery status."
  },
  {
    value: "MESSAGE_SUMMARY",
    label: "Message summary",
    description: "Summarize messages by direction, type, and status."
  }
];

const DATE_RANGES = [
  { label: "Today", value: "today" },
  { label: "Last 3 hours", value: "3h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" }
];

const STATUSES = [
  "pending", "processing", "sent", "delivered",
  "rejected", "undeliverable", "expired", "failed",
  "queued", "read", "received"
];

function validId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError("Invalid report ID", 400);
  }
}

function reportDto(r) {
  return {
    id: String(r._id),
    name: r.name,
    type: r.type,
    filters: r.filters,
    isRecurring: r.isRecurring,
    frequency: r.frequency,
    status: r.status,
    runCount: r.runCount,
    lastRunAt: r.lastRunAt,
    lastError: r.lastError,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}

function dateStart(range) {
  const now = new Date();
  const start = new Date(now);

  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "3h":
      start.setTime(now.getTime() - 3 * 60 * 60 * 1000);
      break;
    case "24h":
      start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      start.setDate(now.getDate() - 7);
      break;
    case "30d":
      start.setDate(now.getDate() - 30);
      break;
    case "90d":
      start.setDate(now.getDate() - 90);
      break;
    default:
      throw httpError("Unsupported date range", 400);
  }

  return start;
}

async function findReport(organizationId, id) {
  validId(id);

  const report = await SavedReport.findOne({
    _id: id,
    organizationId
  });

  if (!report) throw httpError("Report not found", 404);
  return report;
}

function messageFilter(organizationId, report) {
  const filter = {
    organizationId,
    messageAt: { $gte: dateStart(report.filters.range) }
  };

  if (report.type === "MESSAGE_LEVEL" && report.filters.status) {
    const allowed = report.filters.status
      .split(",")
      .map((status) => status.trim().toUpperCase())
      .filter(Boolean);

    if (allowed.length) filter.status = { $in: allowed };
  }

  return filter;
}

export function getReportTypes() {
  return REPORT_TYPES;
}

export function getAnalyticsFilters() {
  return { dateRanges: DATE_RANGES, statuses: STATUSES };
}

export async function listReports(organizationId, { tab, page, limit }) {
  const filter = { organizationId };

  if (tab === "recurring") filter.isRecurring = true;

  const [rows, total] = await Promise.all([
    SavedReport.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SavedReport.countDocuments(filter)
  ]);

  return {
    items: rows.map(reportDto),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit))
  };
}

export async function createReport(organizationId, userId, input) {
  if (!REPORT_TYPES.some((t) => t.value === input.type)) {
    throw httpError("Invalid report type");
  }

  if (!DATE_RANGES.some((r) => r.value === input.filters?.range)) {
    throw httpError("Invalid date range");
  }

  if (input.isRecurring && input.frequency !== "WEEKLY") {
    throw httpError("Only WEEKLY recurring reports are supported");
  }

  const report = await SavedReport.create({
    organizationId,
    createdBy: userId,
    name: input.name,
    type: input.type,
    filters: {
      tz: input.filters?.tz || "UTC",
      range: input.filters.range,
      status: input.filters.status || ""
    },
    isRecurring: Boolean(input.isRecurring),
    frequency: input.isRecurring ? "WEEKLY" : "WEEKLY"
  });

  return reportDto(report);
}

export async function getReport(organizationId, id) {
  return reportDto(await findReport(organizationId, id));
}

export async function updateReport(organizationId, id, input) {
  const report = await findReport(organizationId, id);

  if (input.name !== undefined) {
    report.name = input.name;
  }

  await report.save();
  return reportDto(report);
}

export async function deleteReport(organizationId, id) {
  const report = await findReport(organizationId, id);
  await report.deleteOne();
}

export async function executeReport(organizationId, id) {
  const report = await findReport(organizationId, id);
  const filter = messageFilter(organizationId, report);

  let result;

  if (report.type === "MESSAGE_SUMMARY") {
    const rows = await Message.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { status: "$status", direction: "$direction" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.direction": 1, "_id.status": 1 } }
    ]);

    result = {
      columns: ["direction", "status", "count"],
      rows: rows.map((r) => [
        r._id.direction,
        r._id.status,
        r.count
      ])
    };
  } else {
    const rows = await Message.find(filter)
      .sort({ messageAt: -1 })
      .limit(10000)
      .select(
        "phone direction type status body messageAt sentAt deliveredAt readAt failedAt errorCode errorMessage campaignId"
      )
      .lean();

    result = {
      columns: [
        "phone", "direction", "type", "status",
        "body", "messageAt", "sentAt", "deliveredAt",
        "readAt", "failedAt", "errorCode",
        "errorMessage", "campaignId"
      ],
      rows: rows.map((m) => [
        m.phone,
        m.direction,
        m.type,
        m.status,
        m.body,
        m.messageAt,
        m.sentAt,
        m.deliveredAt,
        m.readAt,
        m.failedAt,
        m.errorCode,
        m.errorMessage,
        m.campaignId
      ])
    };
  }

  report.runCount += 1;
  report.lastRunAt = new Date();
  report.lastError = "";
  report.status = report.isRecurring ? "ACTIVE" : "READY";
  await report.save();

  return { report: reportDto(report), result };
}

export async function runReportCsv(organizationId, id) {
  const report = await findReport(organizationId, id);
  const { result } = await executeReport(organizationId, id);

  const escape = (value) => {
    const str = value == null
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);

    return `"${str.replace(/"/g, '""')}"`;
  };

  const csv = [
    result.columns.map(escape).join(","),
    ...result.rows.map((row) => row.map(escape).join(","))
  ].join("\r\n");

  return {
    filename: `${report.name.replace(/[^\w-]+/g, "_")}.csv`,
    csv
  };
}
