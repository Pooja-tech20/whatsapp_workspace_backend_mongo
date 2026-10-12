
import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    website: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active"
    }
  },
  { timestamps: true }
);

organizationSchema.index({ email: 1 });

export default mongoose.model(
  "Organization",
  organizationSchema
);
