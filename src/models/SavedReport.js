
import mongoose from "mongoose";

const savedReportSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    type: {
      type: String,
      enum: ["MESSAGE_LEVEL", "MESSAGE_SUMMARY"],
      required: true
    },
    filters: {
      tz: { type: String, default: "UTC" },
      range: { type: String, default: "7d" },
      status: { type: String, default: "" }
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ["WEEKLY"],
      default: "WEEKLY"
    },
    status: {
      type: String,
      enum: ["READY", "ACTIVE", "ERROR"],
      default: "READY"
    },
    runCount: {
      type: Number,
      default: 0
    },
    lastRunAt: {
      type: Date,
      default: null
    },
    lastError: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

savedReportSchema.index({
  organizationId: 1,
  createdAt: -1
});

export default mongoose.model("SavedReport", savedReportSchema);
