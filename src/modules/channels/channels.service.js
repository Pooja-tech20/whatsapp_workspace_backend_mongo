
import mongoose from "mongoose";
import Channel from "../../models/Channel.js";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError("Invalid channel ID", 400);
  }
}

function serializeChannel(channel) {
  return {
    id: String(channel._id),
    organizationId: String(channel.organizationId),
    name: channel.name,
    type: channel.type,
    config: channel.config || {},
    status: channel.status,
    verifiedAt: channel.verifiedAt || null,
    createdBy: channel.createdBy
      ? String(channel.createdBy)
      : null,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt
  };
}

export async function listChannels(
  organizationId,
  { page = 1, limit = 20, search, status } = {}
) {
  const filter = { organizationId };

  if (search) {
    const escaped = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    filter.name = new RegExp(escaped, "i");
  }

  if (status) {
    filter.status = status;
  }

  const [channels, total] = await Promise.all([
    Channel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Channel.countDocuments(filter)
  ]);

  return {
    channels: channels.map(serializeChannel),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

export async function getChannel(organizationId, channelId) {
  validateId(channelId);

  const channel = await Channel.findOne({
    _id: channelId,
    organizationId
  }).lean();

  if (!channel) {
    throw httpError("Channel not found", 404);
  }

  return serializeChannel(channel);
}

export async function createChannel(
  organizationId,
  userId,
  input
) {
  const channel = await Channel.create({
    organizationId,
    createdBy: userId || null,
    name: input.name,
    type: input.type || "WHATSAPP",
    config: input.config || {},
    status: input.status || "PENDING"
  });

  return serializeChannel(channel);
}

export async function updateChannel(
  organizationId,
  channelId,
  input
) {
  validateId(channelId);

  const channel = await Channel.findOne({
    _id: channelId,
    organizationId
  });

  if (!channel) {
    throw httpError("Channel not found", 404);
  }

  if (input.name !== undefined) {
    channel.name = input.name;
  }

  if (input.config !== undefined) {
    channel.config = {
      ...(channel.config?.toObject?.() || channel.config || {}),
      ...input.config
    };
  }

  if (input.status !== undefined) {
    channel.status = input.status;
  }

  await channel.save();

  return serializeChannel(channel);
}

export async function deleteChannel(
  organizationId,
  channelId
) {
  validateId(channelId);

  const channel = await Channel.findOneAndDelete({
    _id: channelId,
    organizationId
  });

  if (!channel) {
    throw httpError("Channel not found", 404);
  }
}
