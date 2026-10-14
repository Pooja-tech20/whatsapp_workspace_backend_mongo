
import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    type: {
      type: String,
      enum: ["WHATSAPP"],
      default: "WHATSAPP",
      required: true
    },

    // Non-secret settings, such as sender and phoneNumberId.
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    accessTokenEncrypted: {
      type: String,
      default: "",
      select: false
    },

    verifyTokenEncrypted: {
      type: String,
      default: "",
      select: false
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "PENDING"],
      default: "PENDING"
    },

    verifiedAt: {
      type: Date,
      default: null
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

channelSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model("Channel", channelSchema);
