
import mongoose from "mongoose";

const whatsAppConnectionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true
    },
    accessTokenEncrypted: { type: String, required: true, select: false },
    phoneNumberId: { type: String, required: true, trim: true },
    businessAccountId: { type: String, required: true, trim: true },
    verifyTokenEncrypted: { type: String, required: true, select: false },
    appSecretEncrypted: { type: String, default: "", select: false },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model(
  "WhatsAppConnection",
  whatsAppConnectionSchema
);
