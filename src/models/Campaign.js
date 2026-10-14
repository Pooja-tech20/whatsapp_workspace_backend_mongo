import mongoose from "mongoose";

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "RUNNING",
  "COMPLETED",
  "STOPPED",
  "FAILED"
];

const campaignSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    name: { type: String, required: true, trim: true, maxlength: 120 },

    // The template is copied here so the list/report keeps working even if
    // the template is renamed or deleted later.
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: true
    },
    templateName: { type: String, default: "" },
    templateCategory: { type: String, default: "" },
    templateType: { type: String, default: "TEXT" },
    // Quick-reply button labels (used by the Automations screen later)
    templateButtons: { type: [String], default: [] },

    // Optional: the list the audience was taken from (informational)
    listId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      default: null
    },

    // Values for {{1}}, {{2}}... Supports per-contact tokens:
    // {{name}}  {{firstName}}  {{lastName}}  {{phone}}
    variables: { type: [String], default: [] },
    headerMediaUrl: { type: String, default: "" },

    status: {
      type: String,
      enum: CAMPAIGN_STATUSES,
      default: "DRAFT",
      index: true
    },

    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    stoppedAt: { type: Date, default: null },
    failureReason: { type: String, default: "" },

    totalRecipients: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

campaignSchema.index({ organizationId: 1, createdAt: -1 });
campaignSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
// Used by the scheduler
campaignSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model("Campaign", campaignSchema);