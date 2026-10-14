
import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";

import Media from "../../models/Media.js";
import { MEDIA_UPLOAD_DIR } from "../../middleware/mediaUpload.middleware.js";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertValidId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError("Invalid media id", 400);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDto(media) {
  return {
    id: media._id,
    fileName: media.fileName,
    mimeType: media.mimeType,
    size: media.size,
    url: media.url,
    createdAt: media.createdAt
  };
}

export async function listMedia(organizationId, { search, page, limit }) {
  const filter = { organizationId };

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { fileName: pattern },
      { mimeType: pattern }
    ];
  }

  const [files, total] = await Promise.all([
    Media.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Media.countDocuments(filter)
  ]);

  return {
    items: files.map(toDto),
    total,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

export async function createMedia({
  organizationId,
  uploadedBy,
  file,
  publicBaseUrl
}) {
  if (!file) {
    throw httpError('Upload a file using the "file" field', 400);
  }

  const url = `${publicBaseUrl}/uploads/media/${encodeURIComponent(
    file.filename
  )}`;

  try {
    const media = await Media.create({
      organizationId,
      uploadedBy,
      fileName: path.basename(file.originalname).slice(0, 255),
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url
    });

    return toDto(media);
  } catch (error) {
    await fs.unlink(file.path).catch(() => {});
    throw error;
  }
}

export async function deleteMedia(organizationId, mediaId) {
  assertValidId(mediaId);

  const media = await Media.findOneAndDelete({
    _id: mediaId,
    organizationId
  });

  if (!media) {
    throw httpError("Media file not found", 404);
  }

  const filePath = path.join(MEDIA_UPLOAD_DIR, media.storedName);
  await fs.unlink(filePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}
