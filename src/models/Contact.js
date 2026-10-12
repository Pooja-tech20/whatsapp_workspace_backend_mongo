import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
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

    // Stored in international format, e.g. +919876543210
    phone: {
      type: String,
      required: true,
      trim: true
    },

    firstName: {
      type: String,
      trim: true,
      default: ""
    },

    lastName: {
      type: String,
      trim: true,
      default: ""
    },

    // Full display name ("Amit Sharma"), kept in sync by the service
    name: {
      type: String,
      trim: true,
      default: ""
    },

    source: {
      type: String,
      enum: ["manual", "csv", "list"],
      default: "manual"
    },

    status: {
      type: String,
      enum: ["saved", "opted_out"],
      default: "saved"
    }
  },
  { timestamps: true }
);

// One phone number per organization
contactSchema.index({ organizationId: 1, phone: 1 }, { unique: true });
// Fast newest-first listing
contactSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model("Contact", contactSchema);