import mongoose from "mongoose";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import Contact from "../../models/Contact.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { normalizePhone } from "../../utils/phone.js";
import {
  findOrCreateContact,
  sendTemplateToPhone,
  sendTextToPhone
} from "../../services/messaging.service.js";
import { markAsRead, resolvePhoneNumberId } from "../../services/whatsapp.service.js";

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

function toConversationDto(conversation, contact, assignee) {
  const expiresAt = conversation.windowExpiresAt || null;

  return {
    id: conversation._id,
    contact: {
      id: conversation.contactId,
      name: contact?.name || contact?.firstName || "",
      phone: conversation.phone,
      status: contact?.status || "saved"
    },
    // What to show in the list: name, or the number when the contact has no name
    title: contact?.name || contact?.firstName || conversation.phone,
    lastMessage: conversation.lastMessage || null,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: conversation.unreadCount || 0,
    status: conversation.status,
    assignedTo: assignee ? { id: assignee._id, name: assignee.name } : null,
    // WhatsApp only allows free text for 24h after the customer's last message
    window: {
      open: Boolean(expiresAt && expiresAt > new Date()),
      expiresAt,
      lastInboundAt: conversation.lastInboundAt
    },
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export function toInboxMessage(message) {
  const hasMedia = Boolean(message.media?.mediaId);

  return {
    id: message._id,
    direction: message.direction,
    type: message.type,
    body: message.body,
    media: message.media
      ? {
          mimeType: message.media.mimeType || "",
          fileName: message.media.fileName || "",
          caption: message.media.caption || "",
          // Fetch this with your Bearer token, then show it as a blob
          url: hasMedia ? `/api/v1/inbox/messages/${message._id}/media` : null
        }
      : null,
    templateName: message.templateName || null,
    campaignId: message.campaignId || null,
    status: message.status,
    errorCode: message.errorCode || null,
    errorMessage: message.errorMessage || null,
    wamid: message.wamid || null,
    replyToWamid: message.replyToWamid || null,
    sentBy: message.sentBy || null,
    sentAt: message.sentAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    failedAt: message.failedAt,
    messageAt: message.messageAt
  };
}

async function findConversationOrFail(organizationId, conversationId) {
  assertValidId(conversationId, "conversation id");

  const conversation = await Conversation.findOne({ _id: conversationId, organizationId }).lean();
  if (!conversation) throw httpError("Conversation not found", 404);

  return conversation;
}

async function buildDtos(conversations) {
  const contactIds = conversations.map((c) => c.contactId);
  const userIds = conversations.map((c) => c.assignedTo).filter(Boolean);

  const [contacts, users] = await Promise.all([
    Contact.find({ _id: { $in: contactIds } }).select("name firstName status").lean(),
    userIds.length ? User.find({ _id: { $in: userIds } }).select("name").lean() : []
  ]);

  const contactMap = new Map(contacts.map((c) => [String(c._id), c]));
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return conversations.map((conversation) =>
    toConversationDto(
      conversation,
      contactMap.get(String(conversation.contactId)),
      conversation.assignedTo ? userMap.get(String(conversation.assignedTo)) : null
    )
  );
}

async function oneDto(organizationId, conversationId) {
  const conversation = await findConversationOrFail(organizationId, conversationId);
  const [dto] = await buildDtos([conversation]);
  return dto;
}

/* ------------------------------ conversations ------------------------------ */

export async function getSummary(organizationId) {
  const [total, open, closed, unreadConversations, unreadAgg] = await Promise.all([
    Conversation.countDocuments({ organizationId }),
    Conversation.countDocuments({ organizationId, status: "open" }),
    Conversation.countDocuments({ organizationId, status: "closed" }),
    Conversation.countDocuments({ organizationId, unreadCount: { $gt: 0 } }),
    Conversation.aggregate([
      { $match: { organizationId } },
      { $group: { _id: null, total: { $sum: "$unreadCount" } } }
    ])
  ]);

  return {
    total,
    open,
    closed,
    unreadConversations,
    unreadMessages: unreadAgg[0]?.total || 0
  };
}

export async function listConversations(organization, userId, query) {
  const organizationId = organization._id;
  const { page, limit, filter, status, assigned, search } = query;

  const base = { organizationId };
  if (status) base.status = status;
  if (assigned === "me") base.assignedTo = userId;
  if (assigned === "unassigned") base.assignedTo = null;

  const and = [];

  if (filter === "unread") and.push({ unreadCount: { $gt: 0 } });

  if (filter === "campaign") {
    // Customers who have received at least one campaign message
    const contactIds = await Message.distinct("contactId", {
      organizationId,
      campaignId: { $ne: null }
    });
    and.push({ contactId: { $in: contactIds } });
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const contactIds = await Contact.distinct("_id", {
      organizationId,
      $or: [{ name: regex }, { firstName: regex }, { lastName: regex }, { phone: regex }]
    });
    and.push({ contactId: { $in: contactIds } });
  }

  const find = and.length ? { ...base, $and: and } : base;

  const [conversations, total, countAll, countUnread] = await Promise.all([
    Conversation.find(find)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(find),
    Conversation.countDocuments(base),
    Conversation.countDocuments({ ...base, unreadCount: { $gt: 0 } })
  ]);

  return {
    conversations: await buildDtos(conversations),
    // Numbers for the tab badges ("Unread 23")
    counts: { all: countAll, unread: countUnread },
    pagination: pagination(page, limit, total)
  };
}

export async function getConversation(organizationId, conversationId) {
  return oneDto(organizationId, conversationId);
}

export async function updateConversation(organizationId, conversationId, data) {
  const conversation = await findConversationOrFail(organizationId, conversationId);
  const set = {};

  if (data.status) set.status = data.status;

  if (data.assignedTo !== undefined) {
    if (data.assignedTo === null) {
      set.assignedTo = null;
    } else {
      const user = await User.findOne({
        _id: data.assignedTo,
        organizationId,
        isActive: true
      })
        .select("_id")
        .lean();

      if (!user) throw httpError("User not found in this organization", 404);
      set.assignedTo = user._id;
    }
  }

  await Conversation.updateOne({ _id: conversation._id }, { $set: set });
  return oneDto(organizationId, conversation._id);
}

/* ------------------------------ messages ------------------------------ */

export async function listMessages(organizationId, conversationId, { limit, before }) {
  const conversation = await findConversationOrFail(organizationId, conversationId);

  // One conversation per contact, so the contact id is the most reliable key
  const filter = { organizationId, contactId: conversation.contactId };

  if (before) {
    const cursor = await Message.findOne({ _id: before, organizationId }).select("messageAt").lean();
    if (!cursor) throw httpError("Cursor message not found", 404);

    filter.$or = [
      { messageAt: { $lt: cursor.messageAt } },
      { messageAt: cursor.messageAt, _id: { $lt: before } }
    ];
  }

  // Newest first from the database, +1 to know if there is more
  const rows = await Message.find(filter)
    .sort({ messageAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Oldest first, ready to render top to bottom
  page.reverse();

  return {
    messages: page.map(toInboxMessage),
    hasMore,
    // Pass this as ?before= to load older messages
    nextBefore: hasMore ? page[0]._id : null
  };
}

export async function replyToConversation(organization, userId, conversationId, { text, replyToWamid }) {
  const conversation = await findConversationOrFail(organization._id, conversationId);

  // Throws 409 with a clear message when the 24h window is closed
  const sent = await sendTextToPhone({
    organization,
    userId,
    phone: conversation.phone,
    text,
    replyToWamid
  });

  // A reply to a closed chat reopens it
  if (conversation.status === "closed") {
    await Conversation.updateOne({ _id: conversation._id }, { $set: { status: "open" } });
  }

  const message = await Message.findById(sent.id).lean();
  return toInboxMessage(message);
}

export async function sendTemplateToConversation(organization, userId, conversationId, data) {
  const conversation = await findConversationOrFail(organization._id, conversationId);

  const sent = await sendTemplateToPhone({
    organization,
    userId,
    phone: conversation.phone,
    templateId: data.templateId,
    variables: data.variables,
    headerMediaUrl: data.headerMediaUrl
  });

  if (conversation.status === "closed") {
    await Conversation.updateOne({ _id: conversation._id }, { $set: { status: "open" } });
  }

  const message = await Message.findById(sent.id).lean();
  return toInboxMessage(message);
}

// "New chat": the customer has never written to us, so the first message must be a template
export async function startConversation(organization, userId, data) {
  const phone = normalizePhone(data.phone);
  if (!phone) throw httpError("Invalid phone number", 400);

  const contact = await findOrCreateContact(organization._id, phone, {
    name: data.name || "",
    createdBy: userId
  });

  // Give an existing nameless contact the name that was typed now
  if (data.name && !contact.name) {
    await Contact.updateOne(
      { _id: contact._id },
      { $set: { name: data.name, firstName: data.name } }
    );
  }

  const sent = await sendTemplateToPhone({
    organization,
    userId,
    phone,
    templateId: data.templateId,
    variables: data.variables,
    headerMediaUrl: data.headerMediaUrl
  });

  const conversation = await Conversation.findOne({
    organizationId: organization._id,
    contactId: contact._id
  }).lean();

  const message = await Message.findById(sent.id).lean();

  return {
    conversation: conversation ? (await buildDtos([conversation]))[0] : null,
    message: toInboxMessage(message)
  };
}

export async function markConversationRead(organization, conversationId, { notifyCustomer }) {
  const conversation = await findConversationOrFail(organization._id, conversationId);

  await Conversation.updateOne({ _id: conversation._id }, { $set: { unreadCount: 0 } });

  let notified = false;

  if (notifyCustomer && conversation.unreadCount > 0) {
    // Meta marks this message and everything before it as read
    const lastInbound = await Message.findOne({
      organizationId: organization._id,
      contactId: conversation.contactId,
      direction: "IN",
      wamid: { $exists: true }
    })
      .sort({ messageAt: -1, _id: -1 })
      .select("wamid")
      .lean();

    if (lastInbound?.wamid) {
      try {
        await markAsRead({
          phoneNumberId: resolvePhoneNumberId(organization),
          wamid: lastInbound.wamid
        });
        notified = true;
      } catch (error) {
        // Never block the agent because WhatsApp refused a read receipt
        logger.warn({ err: error }, "Could not send the read receipt to WhatsApp");
      }
    }
  }

  return { conversationId: conversation._id, unreadCount: 0, notified };
}

/* ------------------------------ media ------------------------------ */

// Customer photos / documents live on Meta's servers and need our token to download
export async function openMessageMedia(organizationId, messageId) {
  assertValidId(messageId, "message id");

  const message = await Message.findOne({ _id: messageId, organizationId })
    .select("media")
    .lean();

  if (!message?.media?.mediaId) throw httpError("This message has no media", 404);
  if (!env.WHATSAPP_ACCESS_TOKEN) throw httpError("WhatsApp is not connected", 409);

  const headers = { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` };
  const version = env.WHATSAPP_GRAPH_VERSION || "v23.0";

  const info = await fetch(`https://graph.facebook.com/${version}/${message.media.mediaId}`, {
    headers,
    signal: AbortSignal.timeout(30000)
  }).catch(() => null);

  if (!info?.ok) {
    throw httpError("Could not load this file from WhatsApp (it may have expired)", 502);
  }

  const meta = await info.json();

  const file = await fetch(meta.url, { headers, signal: AbortSignal.timeout(60000) }).catch(() => null);
  if (!file?.ok || !file.body) {
    throw httpError("Could not download this file from WhatsApp", 502);
  }

  return {
    contentType: meta.mime_type || message.media.mimeType || "application/octet-stream",
    fileName: message.media.fileName || "",
    body: file.body
  };
}
