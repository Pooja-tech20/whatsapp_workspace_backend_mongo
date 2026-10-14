
import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    storedName: {
      type: String,
      required: true,
      unique: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true,
      min: 1
    },
    url: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

mediaSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model("Media", mediaSchema);
