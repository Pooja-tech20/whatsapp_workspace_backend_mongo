import crypto from "crypto";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import Contact from "../../models/Contact.js";
import Message from "../../models/Message.js";
import Organization from "../../models/Organization.js";
import Template from "../../models/Template.js";
import WebhookEvent from "../../models/WebhookEvent.js";
import { normalizePhone } from "../../utils/phone.js";
import {
  findOrCreateContact,
  touchConversation
} from "../../services/messaging.service.js";

/* ------------------------------ security ------------------------------ */

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function isValidVerifyToken(token) {
  return Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) && safeEqual(token ?? "", env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
}

// Meta signs every POST: X-Hub-Signature-256 = "sha256=" + HMAC_SHA256(rawBody, appSecret)
export function verifySignature(rawBody, signatureHeader) {
  if (!env.WHATSAPP_APP_SECRET) {
    // Never accept unsigned events in production
    if (env.NODE_ENV === "production") return false;

    logger.warn("WHATSAPP_APP_SECRET is not set - skipping webhook signature check (development only)");
    return true;
  }

  if (!rawBody || typeof signatureHeader !== "string" || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest("hex");

  return safeEqual(signatureHeader.slice("sha256=".length), expected);
}

/* ------------------------------ helpers ------------------------------ */

const STATUS_RANK = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 };
const STATUS_FIELD = { SENT: "sentAt", DELIVERED: "deliveredAt", READ: "readAt" };

const OPT_OUT_PATTERN = /^\s*(stop|stop all|unsubscribe|opt[\s-]?out|cancel)\s*[.!]?\s*$/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fromUnixSeconds = (value) => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
};

// Returns true the first time we see an event, false for Meta's retries
async function claimEvent(key, type, payload) {
  try {
    await WebhookEvent.create({ key, type, payload });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

async function resolveOrganizationId(phoneNumberId) {
  if (phoneNumberId) {
    const organization = await Organization.findOne({
      "whatsapp.phoneNumberId": phoneNumberId
    }).select("_id");

    if (organization) return organization._id;
  }

  return env.WHATSAPP_DEFAULT_ORGANIZATION_ID || null;
}

// What to show in the Inbox for any kind of inbound message
export function extractInbound(message) {
  const type = String(message.type || "text").toLowerCase();

  switch (type) {
    case "text":
      return { type: "TEXT", body: message.text?.body || "", media: null };

    case "button":
      return { type: "BUTTON", body: message.button?.text || message.button?.payload || "", media: null };

    case "interactive": {
      const reply = message.interactive?.button_reply || message.interactive?.list_reply;
      return { type: "INTERACTIVE", body: reply?.title || "", media: null };
    }

    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const item = message[type] || {};

      return {
        type: type.toUpperCase(),
        body: item.caption || `[${type}]`,
        media: {
          mediaId: item.id || "",
          mimeType: item.mime_type || "",
          fileName: item.filename || "",
          caption: item.caption || ""
        }
      };
    }

    case "location": {
      const { name, address, latitude, longitude } = message.location || {};
      return { type: "LOCATION", body: [name, address].filter(Boolean).join(", ") || `${latitude}, ${longitude}`, media: null };
    }

    case "reaction":
      return { type: "REACTION", body: message.reaction?.emoji ? `Reacted ${message.reaction.emoji}` : "[reaction]", media: null };

    default:
      return { type: type.toUpperCase(), body: `[${type} message]`, media: null };
  }
}

/* ------------------------------ delivery status ------------------------------ */

async function handleStatus(organizationId, status) {
  const wamid = status.id;
  const next = String(status.status || "").toUpperCase();

  if (!wamid || !["SENT", "DELIVERED", "READ", "FAILED"].includes(next)) return;

  const claimed = await claimEvent(`status:${wamid}:${next}`, "status", status);
  if (!claimed) return;

  // The webhook can beat our own "save wamid" step by a few milliseconds
  let message = await Message.findOne({ wamid }).select("_id status");
  if (!message) {
    await sleep(1500);
    message = await Message.findOne({ wamid }).select("_id status");
  }

  if (!message) {
    logger.warn({ wamid, status: next }, "Status webhook for an unknown message (sent outside this app?)");
    return;
  }

  const at = fromUnixSeconds(status.timestamp);

  if (next === "FAILED") {
    const error = status.errors?.[0] || {};

    await Message.updateOne(
      { _id: message._id, status: { $in: ["QUEUED", "SENT"] } },
      {
        $set: {
          status: "FAILED",
          failedAt: at,
          errorCode: String(error.code ?? ""),
          errorMessage: error.error_data?.details || error.title || error.message || "Message failed"
        }
      }
    );
    return;
  }

  // Webhooks can arrive out of order: only ever move forward (SENT -> DELIVERED -> READ)
  const lowerStatuses = Object.keys(STATUS_RANK).filter((s) => STATUS_RANK[s] < STATUS_RANK[next]);

  const set = { status: next, [STATUS_FIELD[next]]: at };

  await Message.updateOne({ _id: message._id, status: { $in: lowerStatuses } }, { $set: set });

  // Keep timestamps for earlier steps if their webhooks were missed or late
  if (next === "READ") {
    await Message.updateOne({ _id: message._id, deliveredAt: null }, { $set: { deliveredAt: at } });
  }
  if (next === "DELIVERED" || next === "READ") {
    await Message.updateOne({ _id: message._id, sentAt: null }, { $set: { sentAt: at } });
  }

  // TODO (campaigns phase): bump Campaign counters here using message.campaignId
  // TODO (inbox phase): emit a socket event so the UI ticks update live
}

/* ------------------------------ inbound messages ------------------------------ */

async function handleInbound(organizationId, message, profileNames) {
  if (!message.id) return;

  const claimed = await claimEvent(`in:${message.id}`, "inbound", message);
  if (!claimed) return;

  const phone = normalizePhone(`+${message.from}`);
  if (!phone) {
    logger.warn({ from: message.from }, "Inbound message with an unreadable phone number");
    return;
  }

  const at = fromUnixSeconds(message.timestamp);
  const content = extractInbound(message);

  const contact = await findOrCreateContact(organizationId, phone, {
    name: profileNames.get(String(message.from)) || ""
  });

  const conversation = await touchConversation({
    organizationId,
    contact,
    direction: "IN",
    body: content.body,
    at
  });

  await Message.create({
    organizationId,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: "IN",
    type: content.type,
    phone,
    body: content.body,
    media: content.media,
    wamid: message.id,
    replyToWamid: message.context?.id || "",
    status: "RECEIVED",
    messageAt: at
  });

  // STOP / UNSUBSCRIBE keeps you compliant and protects your quality rating
  if (content.type === "TEXT" && OPT_OUT_PATTERN.test(content.body)) {
    await Contact.updateOne({ _id: contact._id }, { $set: { status: "opted_out" } });
  }

  // TODO (inbox phase): emit a socket event so the UI shows the message live
  // TODO (automations phase): run keyword / out-of-hours auto-replies here
}

/* ------------------------------ template review ------------------------------ */

const TEMPLATE_STATUS = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PENDING: "PENDING",
  IN_APPEAL: "PENDING",
  PAUSED: "PAUSED",
  DISABLED: "DISABLED"
};

async function handleTemplateStatus(value, entryTime) {
  const event = String(value.event || "").toUpperCase();
  const status = TEMPLATE_STATUS[event];
  const metaTemplateId = String(value.message_template_id || "");

  if (!status || !metaTemplateId) return;

  const claimed = await claimEvent(
    `tpl:${metaTemplateId}:${event}:${entryTime}`,
    "template",
    value
  );
  if (!claimed) return;

  const reason = value.reason && value.reason !== "NONE" ? String(value.reason) : "";

  await Template.updateMany(
    { metaTemplateId },
    {
      $set: {
        status,
        rejectionReason: status === "REJECTED" ? reason : "",
        syncedAt: new Date()
      }
    }
  );
}

/* ------------------------------ entry point ------------------------------ */

async function handleMessagesChange(value) {
  const organizationId = await resolveOrganizationId(value.metadata?.phone_number_id);

  if (!organizationId) {
    logger.warn(
      { phoneNumberId: value.metadata?.phone_number_id },
      "Webhook ignored: no organization found. Set WHATSAPP_DEFAULT_ORGANIZATION_ID in .env."
    );
    return;
  }

  const profileNames = new Map(
    (value.contacts || []).map((c) => [String(c.wa_id), c.profile?.name || ""])
  );

  for (const status of value.statuses || []) {
    await handleStatus(organizationId, status).catch((error) =>
      logger.error({ err: error, wamid: status.id }, "Failed to process status webhook")
    );
  }

  for (const message of value.messages || []) {
    await handleInbound(organizationId, message, profileNames).catch((error) =>
      logger.error({ err: error, wamid: message.id }, "Failed to process inbound message")
    );
  }
}

// Called after we have already answered 200 to Meta
export async function processWebhook(payload) {
  if (payload?.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      try {
        if (change.field === "messages") {
          await handleMessagesChange(change.value || {});
        } else if (change.field === "message_template_status_update") {
          await handleTemplateStatus(change.value || {}, entry.time || "");
        }
        // Other fields (quality updates, account alerts...) are ignored for now
      } catch (error) {
        logger.error({ err: error, field: change.field }, "Webhook processing failed");
      }
    }
  }
}