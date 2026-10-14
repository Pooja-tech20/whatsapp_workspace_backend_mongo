import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    mediaId: { type: String, default: "" }, // Meta media id (inbound)
    url: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    fileName: { type: String, default: "" },
    caption: { type: String, default: "" }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null
    },

    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true
    },

    // Filled in by the campaigns module (next phase)
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null
    },

    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    direction: { type: String, enum: ["IN", "OUT"], required: true },

    // TEXT, TEMPLATE, IMAGE, VIDEO, DOCUMENT, AUDIO, BUTTON, INTERACTIVE, LOCATION...
    type: { type: String, default: "TEXT" },

    // International format, e.g. +919876543210 (the customer's number)
    phone: { type: String, required: true },

    body: { type: String, default: "" },
    media: { type: mediaSchema, default: null },

    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      default: null
    },
    templateName: { type: String, default: "" },
    templateCategory: { type: String, default: "" },

    // Meta's message id. Delivery/read webhooks match on this.
    wamid: { type: String, default: undefined },
    replyToWamid: { type: String, default: "" },

    // QUEUED -> SENT -> DELIVERED -> READ, or FAILED. RECEIVED = inbound.
    status: {
      type: String,
      enum: ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "RECEIVED"],
      default: "QUEUED"
    },

    errorCode: { type: String, default: "" },
    errorMessage: { type: String, default: "" },

    // Cost deducted for this message (wallet phase)
    cost: { type: Number, default: 0 },

    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },

    // When the message happened on WhatsApp (inbound) or was created (outbound)
    messageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// wamid is unique, but only for messages that have one (queued ones do not yet)
messageSchema.index(
  { wamid: 1 },
  { unique: true, partialFilterExpression: { wamid: { $type: "string" } } }
);
messageSchema.index({ organizationId: 1, conversationId: 1, messageAt: -1 });
messageSchema.index({ organizationId: 1, campaignId: 1, status: 1 });
messageSchema.index({ organizationId: 1, contactId: 1, messageAt: -1 });

export default mongoose.model("Message", messageSchema);