import mongoose from "mongoose";

const exportDestinationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  host: { type: String, required: true, trim: true },
  port: { type: Number, default: 22, min: 1, max: 65535 },
  username: { type: String, required: true, trim: true },
  // Store encrypted credentials in production; never return this field from API responses.
  password: { type: String, required: true, select: false },
  remotePath: { type: String, default: "/", trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("ExportDestination", exportDestinationSchema);
