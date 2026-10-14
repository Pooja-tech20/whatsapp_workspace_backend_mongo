import mongoose from "mongoose";

const automationSchema = new mongoose.Schema(
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
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    triggerType: {
      type: String,
      enum: ["KEYWORD"],
      default: "KEYWORD"
    },
    triggerValue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    replyText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4096
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

automationSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.models.Automation ||
  mongoose.model("Automation", automationSchema);