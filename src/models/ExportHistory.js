import mongoose from "mongoose";

const exportHistorySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  destinationId: { type: mongoose.Schema.Types.ObjectId, ref: "ExportDestination", default: null },
  destinationName: { type: String, default: "" },
  status: { type: String, enum: ["queued", "success", "failed"], default: "queued" },
  fileName: { type: String, default: "" },
  recordCount: { type: Number, default: 0 },
  errorMessage: { type: String, default: "" },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("ExportHistory", exportHistorySchema);
