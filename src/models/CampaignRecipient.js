import mongoose from "mongoose";

// One document = one contact inside one campaign (a snapshot taken when the
// contact is added, so later edits to the contact do not change a running campaign).
const campaignRecipientSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true
    },

    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true
    },

    phone: { type: String, required: true },
    name: { type: String, default: "" },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },

    // PENDING    -> waiting to be sent
    // PROCESSING -> picked up by the runner (prevents double sends)
    // SENT       -> accepted by Meta (see Message for delivered / read / failed)
    // FAILED     -> the send was attempted and failed
    // SKIPPED    -> never sent: opted out or invalid number
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SENT", "FAILED", "SKIPPED"],
      default: "PENDING"
    },

    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null
    },

    error: { type: String, default: "" },
    processedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

campaignRecipientSchema.index({ campaignId: 1, contactId: 1 }, { unique: true });
campaignRecipientSchema.index({ campaignId: 1, status: 1, _id: 1 });

export default mongoose.model("CampaignRecipient", campaignRecipientSchema);