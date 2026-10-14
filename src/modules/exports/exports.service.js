import mongoose from "mongoose";
import ExportDestination from "../../models/ExportDestination.js";
import ExportHistory from "../../models/ExportHistory.js";
import Message from "../../models/Message.js";

const safeDestination = (doc) => {
  const value = doc?.toObject ? doc.toObject() : { ...doc };
  delete value.password;
  return value;
};

export async function listDestinations(organizationId) {
  const rows = await ExportDestination.find({ organizationId }).sort({ createdAt: -1 });
  return rows.map(safeDestination);
}

export async function createDestination(organizationId, input) {
  const destination = await ExportDestination.create({ ...input, organizationId });
  return safeDestination(destination);
}

export async function updateDestination(organizationId, id, input) {
  if (!mongoose.isValidObjectId(id)) return null;
  const destination = await ExportDestination.findOneAndUpdate(
    { _id: id, organizationId }, { $set: input }, { new: true, runValidators: true }
  );
  return destination ? safeDestination(destination) : null;
}

export async function deleteDestination(organizationId, id) {
  if (!mongoose.isValidObjectId(id)) return false;
  const result = await ExportDestination.deleteOne({ _id: id, organizationId });
  return result.deletedCount === 1;
}

export async function listHistory(organizationId, limit = 25) {
  return ExportHistory.find({ organizationId })
    .populate("destinationId", "name")
    .sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(limit) || 25, 1), 100));
}

// Creates a CSV export record and stores message-log data as an export payload.
// SFTP transfer is deliberately separate; configure encrypted credentials and an SFTP client before enabling remote delivery.
export async function prepareExport({ organizationId, userId, destinationId }) {
  const destination = await ExportDestination.findOne({ _id: destinationId, organizationId, isActive: true });
  if (!destination) throw Object.assign(new Error("Active export destination not found"), { statusCode: 404 });

  const history = await ExportHistory.create({
    organizationId, destinationId: destination._id, destinationName: destination.name,
    status: "queued", requestedBy: userId
  });

  try {
    const messages = await Message.find({ organizationId })
      .select("_id direction from to type status textBody createdAt conversationId")
      .sort({ createdAt: -1 }).limit(10000).lean();
    const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = ["messageId", "direction", "from", "to", "type", "status", "text", "createdAt", "conversationId"];
    const rows = messages.map((m) => [m._id, m.direction, m.from, m.to, m.type, m.status, m.textBody, m.createdAt?.toISOString?.() ?? m.createdAt, m.conversationId].map(csvEscape).join(","));
    const fileName = `message-logs-${new Date().toISOString().replaceAll(":", "-")}.csv`;
    await ExportHistory.updateOne({ _id: history._id, organizationId }, {
      $set: { status: "queued", fileName, recordCount: messages.length }
    });
    return { historyId: history._id, fileName, recordCount: messages.length, csv: [header.join(","), ...rows].join("\n") };
  } catch (error) {
    await ExportHistory.updateOne({ _id: history._id, organizationId }, {
      $set: { status: "failed", errorMessage: error.message, completedAt: new Date() }
    });
    throw error;
  }
}
