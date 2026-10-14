import mongoose from "mongoose";

import Campaign from "../../models/Campaign.js";
import CampaignRecipient from "../../models/CampaignRecipient.js";
import Contact from "../../models/Contact.js";
import List from "../../models/List.js";
import ListMember from "../../models/ListMember.js";
import Message from "../../models/Message.js";
import Template from "../../models/Template.js";
import {
  assertSendConfigured,
  resolvePhoneNumberId
} from "../../services/whatsapp.service.js";
import { runCampaign } from "./campaigns.runner.js";

const EDITABLE = ["DRAFT", "SCHEDULED"];
const STARTABLE = ["DRAFT", "SCHEDULED", "STOPPED"];
const RETRYABLE = ["COMPLETED", "STOPPED", "FAILED"];
const ID_BATCH = 1000;

/* ------------------------------ helpers ------------------------------ */

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertValidId(id, label = "id") {
  if (!mongoose.isValidObjectId(id)) throw httpError(`Invalid ${label}`, 400);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pagination(page, limit, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

function blankStats(total = 0) {
  return { total, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, skipped: 0 };
}

/**
 * Live numbers for a set of campaigns.
 *  sent      = accepted by Meta (SENT + DELIVERED + READ)
 *  delivered = DELIVERED + READ
 *  read      = READ
 * They come from Message, so the webhook keeps them up to date by itself.
 */
async function loadStats(organizationId, campaigns) {
  const stats = new Map(campaigns.map((c) => [String(c._id), blankStats(c.totalRecipients)]));
  if (campaigns.length === 0) return stats;

  const ids = campaigns.map((c) => c._id);

  const [messageRows, recipientRows] = await Promise.all([
    Message.aggregate([
      { $match: { organizationId, campaignId: { $in: ids }, direction: "OUT" } },
      { $group: { _id: { c: "$campaignId", s: "$status" }, n: { $sum: 1 } } }
    ]),
    CampaignRecipient.aggregate([
      { $match: { organizationId, campaignId: { $in: ids } } },
      {
        $group: {
          _id: {
            c: "$campaignId",
            s: "$status",
            noMessage: { $eq: [{ $ifNull: ["$messageId", null] }, null] }
          },
          n: { $sum: 1 }
        }
      }
    ])
  ]);

  for (const { _id, n } of messageRows) {
    const s = stats.get(String(_id.c));
    if (!s) continue;
    if (["SENT", "DELIVERED", "READ"].includes(_id.s)) s.sent += n;
    if (["DELIVERED", "READ"].includes(_id.s)) s.delivered += n;
    if (_id.s === "READ") s.read += n;
    if (_id.s === "FAILED") s.failed += n;
  }

  for (const { _id, n } of recipientRows) {
    const s = stats.get(String(_id.c));
    if (!s) continue;
    if (["PENDING", "PROCESSING"].includes(_id.s)) s.pending += n;
    if (_id.s === "SKIPPED") s.skipped += n;
    // A failure that never produced a Message would otherwise be invisible
    if (_id.s === "FAILED" && _id.noMessage) s.failed += n;
  }

  return stats;
}

function toCampaignDto(campaign, stats = blankStats(campaign.totalRecipients), list = null) {
  return {
    id: campaign._id,
    name: campaign.name,
    status: campaign.status,
    template: {
      id: campaign.templateId,
      name: campaign.templateName,
      category: campaign.templateCategory,
      type: campaign.templateType,
      buttons: campaign.templateButtons
    },
    list,
    variables: campaign.variables,
    headerMediaUrl: campaign.headerMediaUrl || null,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    stoppedAt: campaign.stoppedAt,
    failureReason: campaign.failureReason || null,
    totalRecipients: campaign.totalRecipients,
    stats,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt
  };
}

async function findCampaignOrFail(organizationId, campaignId) {
  assertValidId(campaignId, "campaign id");

  const campaign = await Campaign.findOne({ _id: campaignId, organizationId }).lean();
  if (!campaign) throw httpError("Campaign not found", 404);

  return campaign;
}

async function loadTemplateOrFail(organizationId, templateId) {
  const template = await Template.findOne({ _id: templateId, organizationId }).lean();
  if (!template) throw httpError("Template not found", 404);

  if (template.status !== "APPROVED") {
    throw httpError(
      `Template "${template.name}" is ${template.status}. Only approved templates can be used in a campaign.`,
      409
    );
  }

  return template;
}

function assertVariables(template, variables) {
  if (variables.length < template.variableCount) {
    throw httpError(
      `Template "${template.name}" needs ${template.variableCount} variable(s) but ${variables.length} were given`,
      400
    );
  }
}

function assertFutureDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw httpError("scheduledAt must be a future date", 400);
  }
  return date;
}

/* ------------------------------ recipients ------------------------------ */

async function refreshTotal(organizationId, campaignId) {
  const total = await CampaignRecipient.countDocuments({
    organizationId,
    campaignId
  });

  await Campaign.updateOne(
    { _id: campaignId, organizationId },
    { $set: { totalRecipients: total } }
  );

  return total;
}

async function addContactBatch(campaign, contactIds) {
  const contacts = await Contact.find({
    organizationId: campaign.organizationId,
    _id: { $in: contactIds }
  })
    .select("phone name firstName lastName status")
    .lean();

  if (contacts.length === 0) return 0;

  // upsert + $setOnInsert = adding the same contact twice is harmless
  const operations = contacts.map((contact) => {
    const optedOut = contact.status === "opted_out";

    return {
      updateOne: {
        filter: { campaignId: campaign._id, contactId: contact._id },
        update: {
          $setOnInsert: {
            organizationId: campaign.organizationId,
            phone: contact.phone,
            name: contact.name || "",
            firstName: contact.firstName || "",
            lastName: contact.lastName || "",
            status: optedOut ? "SKIPPED" : "PENDING",
            error: optedOut ? "Contact has opted out" : ""
          }
        },
        upsert: true
      }
    };
  });

  const result = await CampaignRecipient.bulkWrite(operations, { ordered: false });
  return result.upsertedCount || 0;
}

async function addContactIds(campaign, contactIds) {
  const unique = [...new Set(contactIds.map(String))];
  let added = 0;

  for (let i = 0; i < unique.length; i += ID_BATCH) {
    added += await addContactBatch(campaign, unique.slice(i, i + ID_BATCH));
  }

  return added;
}

async function addListMembers(campaign, listId) {
  const list = await List.findOne({ _id: listId, organizationId: campaign.organizationId })
    .select("_id")
    .lean();

  if (!list) throw httpError("List not found", 404);

  const cursor = ListMember.find({ organizationId: campaign.organizationId, listId })
    .select("contactId")
    .lean()
    .cursor();

  let batch = [];
  let added = 0;

  for await (const member of cursor) {
    batch.push(member.contactId);

    if (batch.length >= ID_BATCH) {
      added += await addContactBatch(campaign, batch);
      batch = [];
    }
  }

  if (batch.length > 0) added += await addContactBatch(campaign, batch);

  return added;
}

export async function addRecipients(organizationId, campaignId, { listId, contactIds }) {
  const campaign = await findCampaignOrFail(organizationId, campaignId);

  if (!EDITABLE.includes(campaign.status)) {
    throw httpError(`Recipients can only be changed while the campaign is a draft or scheduled (it is ${campaign.status})`, 409);
  }

  if (listId) assertValidId(listId, "list id");

  let added = 0;
  if (listId) added += await addListMembers(campaign, listId);
  if (contactIds?.length) added += await addContactIds(campaign, contactIds);

  const total = await refreshTotal(campaign._id);

  return { addedCount: added, totalRecipients: total };
}

export async function listRecipients(organizationId, campaignId, { page, limit, search, status }) {
  const campaign = await findCampaignOrFail(organizationId, campaignId);

  const filter = {
  organizationId,
  campaignId: campaign._id
};
  if (status) filter.status = status;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { phone: regex }];
  }

  const [rows, total] = await Promise.all([
    CampaignRecipient.find(filter)
      .sort({ _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CampaignRecipient.countDocuments(filter)
  ]);

  return {
    recipients: rows.map((row) => ({
      id: row._id,
      contactId: row.contactId,
      name: row.name,
      phone: row.phone,
      status: row.status,
      messageId: row.messageId,
      error: row.error || null,
      processedAt: row.processedAt
    })),
    pagination: pagination(page, limit, total)
  };
}

/* ------------------------------ CRUD ------------------------------ */

export async function getSummary(organizationId) {
  const rows = await Campaign.aggregate([
    { $match: { organizationId } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  const by = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return {
    total,
    active: by.RUNNING || 0,
    scheduled: by.SCHEDULED || 0,
    draft: by.DRAFT || 0,
    completed: by.COMPLETED || 0,
    stopped: by.STOPPED || 0,
    failed: by.FAILED || 0
  };
}

export async function listCampaigns(organizationId, { page, limit, search, status }) {
  const filter = { organizationId };
  if (status) filter.status = status;
  if (search) filter.name = new RegExp(escapeRegex(search), "i");

  const [campaigns, total] = await Promise.all([
    Campaign.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Campaign.countDocuments(filter)
  ]);

  const [stats, lists] = await Promise.all([
    loadStats(organizationId, campaigns),
    List.find({ _id: { $in: campaigns.map((c) => c.listId).filter(Boolean) } })
      .select("name")
      .lean()
  ]);

  const listNames = new Map(lists.map((list) => [String(list._id), list.name]));

  return {
    campaigns: campaigns.map((campaign) =>
      toCampaignDto(
        campaign,
        stats.get(String(campaign._id)),
        campaign.listId
          ? { id: campaign.listId, name: listNames.get(String(campaign.listId)) || null }
          : null
      )
    ),
    pagination: pagination(page, limit, total)
  };
}

export async function getCampaign(organizationId, campaignId) {
  const campaign = await findCampaignOrFail(organizationId, campaignId);
  const stats = await loadStats(organizationId, [campaign]);

  let list = null;
  if (campaign.listId) {
    const found = await List.findById(campaign.listId).select("name").lean();
    list = { id: campaign.listId, name: found?.name || null };
  }

  return toCampaignDto(campaign, stats.get(String(campaign._id)), list);
}

export async function createCampaign(organization, userId, data) {
  const template = await loadTemplateOrFail(organization._id, data.templateId);
  assertVariables(template, data.variables);

  const hasAudience = Boolean(data.listId || data.contactIds?.length);

  if (data.listId) {
    const list = await List.findOne({ _id: data.listId, organizationId: organization._id })
      .select("_id")
      .lean();
    if (!list) throw httpError("List not found", 404);
  }

  if ((data.scheduledAt || data.startNow) && !hasAudience) {
    throw httpError("Add a list or contacts before scheduling or starting a campaign", 400);
  }

  const scheduledAt = data.scheduledAt ? assertFutureDate(data.scheduledAt) : null;

  const campaign = await Campaign.create({
    organizationId: organization._id,
    createdBy: userId,
    name: data.name,
    templateId: template._id,
    templateName: template.name,
    templateCategory: template.category,
    templateType: template.type,
    templateButtons: (template.buttons || []).map((button) => button.text),
    listId: data.listId || null,
    variables: data.variables,
    headerMediaUrl: data.headerMediaUrl || "",
    status: "DRAFT",
    scheduledAt
  });

  try {
    if (data.listId) await addListMembers(campaign, data.listId);
    if (data.contactIds?.length) await addContactIds(campaign, data.contactIds);
    await refreshTotal(campaign._id);

    const pending = await CampaignRecipient.countDocuments({ campaignId: campaign._id, status: "PENDING" });

    if (hasAudience && pending === 0) {
      throw httpError("None of the selected contacts can receive messages (all are opted out or missing)", 400);
    }

    if (scheduledAt) {
      await Campaign.updateOne({ _id: campaign._id }, { $set: { status: "SCHEDULED" } });
    }
  } catch (error) {
    // Do not leave a half-built campaign behind
    await CampaignRecipient.deleteMany({ campaignId: campaign._id });
    await Campaign.deleteOne({ _id: campaign._id });
    throw error;
  }

  if (data.startNow) {
    await launch(organization, campaign._id, STARTABLE);
  }

  return getCampaign(organization._id, campaign._id);
}

export async function updateCampaign(organizationId, campaignId, data) {
  const campaign = await findCampaignOrFail(organizationId, campaignId);

  const changesContent =
    data.variables !== undefined ||
    data.headerMediaUrl !== undefined ||
    data.scheduledAt !== undefined;

  if (changesContent && !EDITABLE.includes(campaign.status)) {
    throw httpError(`Only the name can be changed once a campaign is ${campaign.status}`, 409);
  }

  const set = {};
  if (data.name !== undefined) set.name = data.name;

  if (data.variables !== undefined) {
    const template = await Template.findById(campaign.templateId).lean();
    if (template) assertVariables(template, data.variables);
    set.variables = data.variables;
  }

  if (data.headerMediaUrl !== undefined) set.headerMediaUrl = data.headerMediaUrl || "";

  if (data.scheduledAt !== undefined) {
    if (data.scheduledAt === null) {
      set.scheduledAt = null;
      set.status = "DRAFT";
    } else {
      if (campaign.totalRecipients === 0) {
        throw httpError("Add recipients before scheduling this campaign", 400);
      }
      set.scheduledAt = assertFutureDate(data.scheduledAt);
      set.status = "SCHEDULED";
    }
  }

  await Campaign.updateOne({ _id: campaign._id }, { $set: set });

  return getCampaign(organizationId, campaign._id);
}

export async function deleteCampaign(organizationId, campaignId) {
  const campaign = await findCampaignOrFail(organizationId, campaignId);

  if (campaign.status === "RUNNING") {
    throw httpError("Stop the campaign before deleting it", 409);
  }

  await CampaignRecipient.deleteMany({ campaignId: campaign._id });
  await Campaign.deleteOne({ _id: campaign._id });
  // Messages are kept on purpose: they are the delivery history and still count in Reports.
}

/* ------------------------------ start / stop / retry ------------------------------ */

async function launch(organization, campaignId, allowedStatuses) {
  const campaign = await findCampaignOrFail(organization._id, campaignId);

  if (campaign.status === "RUNNING") throw httpError("This campaign is already running", 409);

  if (!allowedStatuses.includes(campaign.status)) {
    throw httpError(`A ${campaign.status} campaign cannot be started`, 409);
  }

  assertSendConfigured(resolvePhoneNumberId(organization));
  await loadTemplateOrFail(organization._id, campaign.templateId);

  const pending = await CampaignRecipient.countDocuments({ campaignId: campaign._id, status: "PENDING" });
  if (pending === 0) throw httpError("There are no recipients waiting to be sent", 409);

  // Atomic: two clicks on "Start" cannot launch it twice
  const updated = await Campaign.findOneAndUpdate(
    { _id: campaign._id, organizationId: organization._id, status: { $in: allowedStatuses } },
    {
      $set: {
        status: "RUNNING",
        startedAt: campaign.startedAt || new Date(),
        completedAt: null,
        stoppedAt: null,
        failureReason: ""
      }
    },
    { new: true }
  );

  if (!updated) throw httpError("This campaign is already running", 409);

  runCampaign(updated._id); // background, not awaited
}

export async function startCampaign(organization, campaignId) {
  await launch(organization, campaignId, STARTABLE);
  return getCampaign(organization._id, campaignId);
}

export async function stopCampaign(organizationId, campaignId) {
  const campaign = await findCampaignOrFail(organizationId, campaignId);

  const updated = await Campaign.findOneAndUpdate(
    { _id: campaign._id, status: { $in: ["RUNNING", "SCHEDULED"] } },
    { $set: { status: "STOPPED", stoppedAt: new Date() } },
    { new: true }
  );

  if (!updated) throw httpError(`A ${campaign.status} campaign cannot be stopped`, 409);

  return getCampaign(organizationId, campaignId);
}

export async function retryFailed(organization, campaignId) {
  const campaign = await findCampaignOrFail(organization._id, campaignId);

  if (!RETRYABLE.includes(campaign.status)) {
    throw httpError(`Retry is available after the campaign has finished (it is ${campaign.status})`, 409);
  }

  const reset = await CampaignRecipient.updateMany(
    { campaignId: campaign._id, status: "FAILED" },
    { $set: { status: "PENDING", messageId: null, error: "", processedAt: null } }
  );

  if (reset.modifiedCount === 0) throw httpError("There are no failed recipients to retry", 409);

  try {
    await launch(organization, campaignId, RETRYABLE);
  } catch (error) {
    // Put them back so the numbers stay honest
    await CampaignRecipient.updateMany(
      { campaignId: campaign._id, status: "PENDING", processedAt: null, error: "" },
      { $set: { status: "FAILED", error: "Retry could not start" } }
    );
    throw error;
  }

  return getCampaign(organization._id, campaignId);
}

/* ------------------------------ report ------------------------------ */

export async function getReport(organizationId, campaignId) {
  const campaign = await findCampaignOrFail(organizationId, campaignId);
  const stats = (await loadStats(organizationId, [campaign])).get(String(campaign._id));

  const [messageReasons, recipientReasons] = await Promise.all([
    Message.aggregate([
      { $match: { organizationId, campaignId: campaign._id, direction: "OUT", status: "FAILED" } },
      { $group: { _id: { code: "$errorCode", message: "$errorMessage" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    CampaignRecipient.aggregate([
      { $match: { campaignId: campaign._id, status: "SKIPPED" } },
      { $group: { _id: "$error", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  return {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      status: campaign.status,
      templateName: campaign.templateName,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      failureReason: campaign.failureReason || null
    },
    stats,
    rates: {
      deliveryRate: percent(stats.delivered, stats.sent),
      readRate: percent(stats.read, stats.sent),
      failureRate: percent(stats.failed, stats.total),
      progress: percent(stats.total - stats.pending, stats.total)
    },
    failureReasons: messageReasons.map((row) => ({
      code: row._id.code || null,
      message: row._id.message || "Unknown error",
      count: row.count
    })),
    skippedReasons: recipientReasons.map((row) => ({
      message: row._id || "Skipped",
      count: row.count
    }))
  };
}

// The per-recipient "Message delivery" table
const emptyDelivery = { errorCode: null, sentAt: null, deliveredAt: null, readAt: null, failedAt: null };

export async function listCampaignMessages(organizationId, campaignId, { page, limit, search, status }) {
  const campaign = await findCampaignOrFail(organizationId, campaignId);

  // Nothing was sent to these people, so they only exist as recipients
  if (status === "PENDING" || status === "SKIPPED") {
    const filter = {
      campaignId: campaign._id,
      status: status === "PENDING" ? { $in: ["PENDING", "PROCESSING"] } : "SKIPPED"
    };

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: regex }, { phone: regex }];
    }

    const [rows, total] = await Promise.all([
      CampaignRecipient.find(filter).sort({ _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      CampaignRecipient.countDocuments(filter)
    ]);

    return {
      messages: rows.map((row) => ({
        id: row._id,
        contactId: row.contactId,
        name: row.name,
        phone: row.phone,
        status,
        errorMessage: status === "SKIPPED" ? row.error || null : null,
        ...emptyDelivery
      })),
      pagination: pagination(page, limit, total)
    };
  }

  const filter = { organizationId, campaignId: campaign._id, direction: "OUT" };
  if (status) filter.status = status;

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const contactIds = await Contact.find({ organizationId, name: regex }).distinct("_id");
    filter.$or = [{ phone: regex }, { contactId: { $in: contactIds } }];
  }

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("contactId", "name phone")
      .lean(),
    Message.countDocuments(filter)
  ]);

  return {
    messages: messages.map((message) => ({
      id: message._id,
      contactId: message.contactId?._id || null,
      name: message.contactId?.name || "",
      phone: message.phone,
      status: message.status,
      errorCode: message.errorCode || null,
      errorMessage: message.errorMessage || null,
      sentAt: message.sentAt,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      failedAt: message.failedAt
    })),
    pagination: pagination(page, limit, total)
  };
}
