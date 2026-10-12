import mongoose from "mongoose";

const buttonSchema = new mongoose.Schema(
  {
    type: { type: String, default: "QUICK_REPLY" },
    text: { type: String, required: true, trim: true, maxlength: 25 }
  },
  { _id: false }
);

const headerMediaSchema = new mongoose.Schema(
  {
    originalName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    fileName: { type: String, default: "" } // stored name inside uploads/templates
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
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

    name: { type: String, required: true, trim: true, maxlength: 512 },
    language: { type: String, required: true, default: "en_US" },

    type: {
      type: String,
      enum: ["TEXT", "IMAGE", "VIDEO"],
      default: "TEXT"
    },

    category: {
      type: String,
      enum: ["UTILITY", "MARKETING", "AUTHENTICATION"],
      default: "UTILITY"
    },

    body: { type: String, required: true, maxlength: 1024 },
    footer: { type: String, default: "", maxlength: 60 },

    placeholderExamples: { type: [String], default: [] },
    variableCount: { type: Number, default: 0 },

    headerMedia: { type: headerMediaSchema, default: null },
    buttons: { type: [buttonSchema], default: [] },

    // DRAFT = saved here only. The rest mirror Meta's review status.
    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "PAUSED", "DISABLED"],
      default: "DRAFT",
      index: true
    },

    rejectionReason: { type: String, default: "" },
    metaTemplateId: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
    syncedAt: { type: Date, default: null },

    source: { type: String, enum: ["local", "meta"], default: "local" }
  },
  { timestamps: true }
);

// Same name + language only once per organization (this is also Meta's rule)
templateSchema.index(
  { organizationId: 1, name: 1, language: 1 },
  { unique: true }
);
templateSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model("Template", templateSchema);