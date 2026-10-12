import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },

    // Only the SHA-256 hash is stored, never the token itself
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },

    expiresAt: {
      type: Date,
      required: true
    },

    lastUsedAt: {
      type: Date,
      default: Date.now
    },

    revokedAt: {
      type: Date,
      default: null
    },

    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" }
  },
  { timestamps: true }
);

// MongoDB deletes the document automatically once expiresAt has passed
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RefreshToken", refreshTokenSchema);