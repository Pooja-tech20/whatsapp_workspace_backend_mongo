import mongoose from "mongoose";

// Meta retries webhooks, so the same event can arrive more than once.
// A unique key per event lets us process each one only once.
const webhookEventSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    type: { type: String, default: "" }, // status | inbound | template
    payload: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

// Keep raw events for 30 days (handy for debugging), then Mongo removes them
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("WebhookEvent", webhookEventSchema);