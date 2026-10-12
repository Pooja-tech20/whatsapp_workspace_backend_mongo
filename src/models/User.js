
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    role: {
      type: String,
      enum: ["owner", "admin", "agent"],
      default: "owner"
    },

    isActive: {
      type: Boolean,
      default: true
    },

    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
