import mongoose from "mongoose";
import Automation from "../../models/Automation.js";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError("Invalid automation ID", 400);
  }
}

function dto(item) {
  return {
    id: item._id,
    name: item.name,
    triggerType: item.triggerType,
    triggerValue: item.triggerValue,
    replyText: item.replyText,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

export async function listAutomations(organizationId, query) {
  const filter = { organizationId };

  if (query.search) {
    filter.$or = [
      { name: { $regex: escapeRegex(query.search), $options: "i" } },
      { triggerValue: { $regex: escapeRegex(query.search), $options: "i" } }
    ];
  }

  const [items, total] = await Promise.all([
    Automation.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Automation.countDocuments(filter)
  ]);

  return {
    automations: items.map(dto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit))
    }
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createAutomation(organizationId, userId, input) {
  const item = await Automation.create({
    ...input,
    organizationId,
    createdBy: userId
  });

  return dto(item);
}

export async function updateAutomation(organizationId, automationId, input) {
  validId(automationId);

  const item = await Automation.findOneAndUpdate(
    { _id: automationId, organizationId },
    { $set: input },
    { new: true, runValidators: true }
  ).lean();

  if (!item) throw httpError("Automation not found", 404);

  return dto(item);
}

export async function deleteAutomation(organizationId, automationId) {
  validId(automationId);

  const item = await Automation.findOneAndDelete({
    _id: automationId,
    organizationId
  });

  if (!item) throw httpError("Automation not found", 404);
}