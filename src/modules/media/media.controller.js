
import { z } from "zod";

import {
  listMedia,
  createMedia,
  deleteMedia
} from "./media.service.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional()
});

export async function getMedia(req, res, next) {
  try {
    const query = querySchema.parse(req.query);

    const result = await listMedia(req.organization._id, query);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadMedia(req, res, next) {
  try {
    const baseUrl = (
      process.env.PUBLIC_BASE_URL ||
      `${req.protocol}://${req.get("host")}`
    ).replace(/\/+$/, "");

    const media = await createMedia({
      organizationId: req.organization._id,
      uploadedBy: req.user._id,
      file: req.file,
      publicBaseUrl: baseUrl
    });

    res.status(201).json({
      success: true,
      message: "Media uploaded successfully",
      data: { media }
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMedia(req, res, next) {
  try {
    await deleteMedia(req.organization._id, req.params.id);

    res.status(200).json({
      success: true,
      message: "Media deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}
