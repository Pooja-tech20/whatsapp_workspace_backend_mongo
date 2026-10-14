import mongoose from "mongoose";

const lastMessageSchema = new mongoose.Schema(
  {
    body: { type: String, default: "" },
    direction: { type: String, enum: ["IN", "OUT"], default: "IN" },
    at: { type: Date, default: null }
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true
    },

    phone: { type: String, required: true },

    lastMessage: { type: lastMessageSchema, default: null },
    lastMessageAt: { type: Date, default: null },

    // WhatsApp only allows free-text replies for 24h after the customer's last message
    lastInboundAt: { type: Date, default: null },
    windowExpiresAt: { type: Date, default: null },

    unreadCount: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ["open", "closed"], default: "open" },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

// One conversation per contact per organization
conversationSchema.index({ organizationId: 1, contactId: 1 }, { unique: true });
// Inbox list, newest first
conversationSchema.index({ organizationId: 1, lastMessageAt: -1 });
// "Unread" filter
conversationSchema.index({ organizationId: 1, unreadCount: 1, lastMessageAt: -1 });

export default mongoose.model("Conversation", conversationSchema);