import mongoose from "mongoose";

import { env } from "../config/env.js";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Template from "../models/Template.js";
import { normalizePhone } from "../utils/phone.js";
import { TEMPLATE_URL_PREFIX } from "../middleware/templateUpload.middleware.js";
import {
  resolvePhoneNumberId,
  assertSendConfigured,
  sendTemplateMessage,
  sendTextMessage
} from "./whatsapp.service.js";

/**
 * Sends a message through Meta AND records it in MongoDB.
 * The campaign worker (next phase) calls sendTemplateToPhone() for every recipient.
 */

export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/* ------------------------------ shared helpers ------------------------------ */

export function renderTemplateBody(body, variables = []) {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index) => {
    const value = variables[Number(index) - 1];
    return value === undefined || value === null || value === "" ? match : String(value);
  });
}

export async function findOrCreateContact(
  organizationId,
  phone,
  { name = "", createdBy = null } = {}
) {
  const run = () =>
    Contact.findOneAndUpdate(
      { organizationId, phone },
      {
        $setOnInsert: {
          name,
          firstName: name,
          source: "manual",
          status: "saved",
          createdBy
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

  try {
    return await run();
  } catch (error) {
    // Two requests created the same contact at once; the second one just reads it
    if (error.code === 11000) return run();
    throw error;
  }
}

// Keeps the Inbox row up to date: last message, unread count, 24h reply window
export async function touchConversation({
  organizationId,
  contact,
  direction,
  body = "",
  at = new Date()
}) {
  const update = {
    $set: { lastMessage: { body: body.slice(0, 200), direction, at } },
    $max: { lastMessageAt: at },
    $setOnInsert: { phone: contact.phone }
  };

  if (direction === "IN") {
    update.$max.lastInboundAt = at;
    update.$max.windowExpiresAt = new Date(at.getTime() + REPLY_WINDOW_MS);
    update.$inc = { unreadCount: 1 };
  }

  const run = () =>
    Conversation.findOneAndUpdate(
      { organizationId, contactId: contact._id },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

  try {
    return await run();
  } catch (error) {
    if (error.code === 11000) return run();
    throw error;
  }
}

export function toMessageDto(message) {
  return {
    id: message._id,
    conversationId: message.conversationId,
    contactId: message.contactId,
    campaignId: message.campaignId,
    direction: message.direction,
    type: message.type,
    phone: message.phone,
    body: message.body,
    media: message.media,
    templateName: message.templateName,
    wamid: message.wamid || null,
    status: message.status,
    errorCode: message.errorCode,
    errorMessage: message.errorMessage,
    sentAt: message.sentAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    failedAt: message.failedAt,
    messageAt: message.messageAt,
    createdAt: message.createdAt
  };
}

/* ------------------------------ send + record ------------------------------ */

// Calls Meta, then stores the result on the already-created QUEUED message
async function dispatchAndRecord(message, sendFn) {
  let result;

  try {
    result = await sendFn();
  } catch (error) {
    await Message.updateOne(
      { _id: message._id },
      {
        $set: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: error.metaCode || "SEND_FAILED",
          errorMessage: error.message
        }
      }
    );

    error.messageId = message._id;
    throw error;
  }

  const wamid = result?.messages?.[0]?.id;

  // Atomic on purpose: a "delivered" webhook may land while we are saving
  await Message.updateOne(
    { _id: message._id, status: "QUEUED" },
    { $set: { status: "SENT", sentAt: new Date(), ...(wamid ? { wamid } : {}) } }
  );

  // If the webhook already advanced the status, make sure the wamid is still stored
  if (wamid) {
    await Message.updateOne(
      { _id: message._id, wamid: { $exists: false } },
      { $set: { wamid } }
    );
  }

  return Message.findById(message._id);
}

export async function sendTemplateToPhone({
  organization,
  userId = null,
  phone,
  templateId,
  variables = [],
  headerMediaUrl,
  campaignId = null
}) {
  const to = normalizePhone(phone);
  if (!to) throw httpError("Invalid phone number", 400);

  if (!mongoose.isValidObjectId(templateId)) {
    throw httpError("Invalid template id", 400);
  }

  assertSendConfigured(resolvePhoneNumberId(organization));

  const template = await Template.findOne({
    _id: templateId,
    organizationId: organization._id
  });

  if (!template) throw httpError("Template not found", 404);

  if (template.status !== "APPROVED") {
    throw httpError(
      `Template "${template.name}" is ${template.status}. Only approved templates can be sent.`,
      409
    );
  }

  if (variables.length < template.variableCount) {
    throw httpError(
      `This template needs ${template.variableCount} variable(s) but ${variables.length} were given`,
      400
    );
  }

  // IMAGE / VIDEO templates need a public link for the header file
  let mediaUrl = headerMediaUrl;

  if (template.type !== "TEXT" && !mediaUrl) {
    if (template.headerMedia?.fileName && env.PUBLIC_BASE_URL) {
      mediaUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}${TEMPLATE_URL_PREFIX}/${template.headerMedia.fileName}`;
    } else {
      throw httpError(
        `"${template.name}" is a ${template.type} template. Send headerMediaUrl (a public https link), or set PUBLIC_BASE_URL for templates created in this app. Templates synced from Meta have no local file.`,
        400
      );
    }
  }

  const contact = await findOrCreateContact(organization._id, to, { createdBy: userId });

  if (contact.status === "opted_out") {
    throw httpError("This contact has opted out of messages", 409);
  }

  const body = renderTemplateBody(template.body, variables);

  const message = await Message.create({
    organizationId: organization._id,
    contactId: contact._id,
    campaignId,
    sentBy: userId,
    direction: "OUT",
    type: "TEMPLATE",
    phone: to,
    body,
    templateId: template._id,
    templateName: template.name,
    templateCategory: template.category,
    status: "QUEUED"
  });

  const saved = await dispatchAndRecord(message, () =>
    sendTemplateMessage({
      phoneNumberId: resolvePhoneNumberId(organization),
      to,
      name: template.name,
      language: template.language,
      variables,
      headerMediaUrl: mediaUrl,
      headerType: template.type
    })
  ).finally(async () => {
    const conversation = await touchConversation({
      organizationId: organization._id,
      contact,
      direction: "OUT",
      body
    });

    await Message.updateOne({ _id: message._id }, { $set: { conversationId: conversation._id } });
  });

  return toMessageDto(saved);
}

export async function sendTextToPhone({ organization, userId = null, phone, text, replyToWamid }) {
  const to = normalizePhone(phone);
  if (!to) throw httpError("Invalid phone number", 400);

  assertSendConfigured(resolvePhoneNumberId(organization));

  const contact = await Contact.findOne({ organizationId: organization._id, phone: to });
  const conversation = contact
    ? await Conversation.findOne({ organizationId: organization._id, contactId: contact._id })
    : null;

  if (!conversation?.windowExpiresAt || conversation.windowExpiresAt <= new Date()) {
    throw httpError(
      "The 24-hour reply window is closed for this contact. Send an approved template instead.",
      409
    );
  }

  if (contact.status === "opted_out") {
    throw httpError("This contact has opted out of messages", 409);
  }

  const message = await Message.create({
    organizationId: organization._id,
    conversationId: conversation._id,
    contactId: contact._id,
    sentBy: userId,
    direction: "OUT",
    type: "TEXT",
    phone: to,
    body: text,
    replyToWamid: replyToWamid || "",
    status: "QUEUED"
  });

  const saved = await dispatchAndRecord(message, () =>
    sendTextMessage({
      phoneNumberId: resolvePhoneNumberId(organization),
      to,
      text,
      replyToWamid
    })
  );

  await touchConversation({
    organizationId: organization._id,
    contact,
    direction: "OUT",
    body: text
  });

  return toMessageDto(saved);
}