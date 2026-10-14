
import { z } from "zod";

import {
  listChannels,
  getChannel,
  createChannel,
  updateChannel,
  deleteChannel
} from "./channels.service.js";

const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum([
    "ACTIVE",
    "INACTIVE",
    "PENDING"
  ]).optional()
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.literal("WHATSAPP").default("WHATSAPP"),
  config: z.record(z.string(), z.unknown()).default({}),
  status: z.enum([
    "ACTIVE",
    "INACTIVE",
    "PENDING"
  ]).optional()
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum([
    "ACTIVE",
    "INACTIVE",
    "PENDING"
  ]).optional()
}).refine(
  value => Object.keys(value).length > 0,
  { message: "Provide at least one field to update" }
);

export async function getChannels(req, res, next) {
  try {
    const query = pagingSchema.parse(req.query);

    const data = await listChannels(
      req.organization._id,
      query
    );

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getOneChannel(req, res, next) {
  try {
    const channel = await getChannel(
      req.organization._id,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: { channel }
    });
  } catch (error) {
    next(error);
  }
}

export async function addChannel(req, res, next) {
  try {
    const input = createSchema.parse(req.body);

    const channel = await createChannel(
      req.organization._id,
      req.user._id,
      input
    );

    return res.status(201).json({
      success: true,
      message: "Channel created",
      data: { channel }
    });
  } catch (error) {
    next(error);
  }
}

export async function editChannel(req, res, next) {
  try {
    const input = updateSchema.parse(req.body);

    const channel = await updateChannel(
      req.organization._id,
      req.params.id,
      input
    );

    return res.status(200).json({
      success: true,
      message: "Channel updated",
      data: { channel }
    });
  } catch (error) {
    next(error);
  }
}

export async function removeChannel(req, res, next) {
  try {
    await deleteChannel(
      req.organization._id,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Channel deleted"
    });
  } catch (error) {
    next(error);
  }
}
