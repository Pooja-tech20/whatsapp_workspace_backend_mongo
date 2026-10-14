// import fs from "fs/promises";
// import path from "path";
// import mongoose from "mongoose";

// import Template from "../../models/Template.js";
// import {
//   TEMPLATE_UPLOAD_DIR,
//   TEMPLATE_URL_PREFIX
// } from "../../middleware/templateUpload.middleware.js";
// import {
//   assertMetaConfigured,
//   isMetaConfigured,
//   uploadHeaderSample,
//   createMetaTemplate,
//   listMetaTemplates,
//   deleteMetaTemplate,
//   mapMetaTemplate
// } from "../../services/meta.service.js";

// function httpError(message, statusCode) {
//   const error = new Error(message);
//   error.statusCode = statusCode;
//   return error;
// }

// function escapeRegex(value) {
//   return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// /* ------------------------------ DTO ------------------------------ */

// export function toTemplateDto(template) {
//   const examples = template.placeholderExamples || [];
//   const count = template.variableCount || 0;

//   return {
//     id: template._id,
//     name: template.name,
//     language: template.language,
//     type: template.type,
//     category: template.category,
//     status: template.status,
//     usableInCampaign: template.status === "APPROVED",
//     body: template.body,
//     // Body with the example values filled in, for the "Message preview" panel
//     previewText: template.body.replace(
//       /\{\{\s*(\d+)\s*\}\}/g,
//       (match, index) => examples[Number(index) - 1] || match
//     ),
//     footer: template.footer,
//     variableCount: count,
//     variables: Array.from({ length: count }, (_, index) => ({
//       key: `{{${index + 1}}}`,
//       example: examples[index] || ""
//     })),
//     buttons: (template.buttons || []).map((b) => ({ type: b.type, text: b.text })),
//     headerMedia: template.headerMedia?.fileName
//       ? {
//           originalName: template.headerMedia.originalName,
//           mimeType: template.headerMedia.mimeType,
//           size: template.headerMedia.size,
//           url: `${TEMPLATE_URL_PREFIX}/${template.headerMedia.fileName}`
//         }
//       : null,
//     rejectionReason: template.rejectionReason,
//     source: template.source,
//     submittedAt: template.submittedAt,
//     syncedAt: template.syncedAt,
//     createdAt: template.createdAt,
//     updatedAt: template.updatedAt
//   };
// }

// async function getSummary(organizationId) {
//   const rows = await Template.aggregate([
//     { $match: { organizationId } },
//     { $group: { _id: "$status", count: { $sum: 1 } } }
//   ]);

//   const by = Object.fromEntries(rows.map((row) => [row._id, row.count]));

//   return {
//     approved: by.APPROVED || 0,
//     pending: by.PENDING || 0,
//     rejected: by.REJECTED || 0,
//     draft: by.DRAFT || 0,
//     other: (by.PAUSED || 0) + (by.DISABLED || 0),
//     total: rows.reduce((sum, row) => sum + row.count, 0)
//   };
// }

// async function findTemplateDoc(organizationId, templateId) {
//   if (!mongoose.isValidObjectId(templateId)) {
//     throw httpError("Invalid template id", 400);
//   }

//   const template = await Template.findOne({ _id: templateId, organizationId });
//   if (!template) throw httpError("Template not found", 404);

//   return template;
// }

// /* ------------------------------ LIST / GET ------------------------------ */

// export async function listTemplates(
//   organizationId,
//   { page, limit, search, status, category }
// ) {
//   const filter = { organizationId };

//   if (status && status !== "ALL") filter.status = status;
//   if (category) filter.category = category;

//   if (search) {
//     const pattern = new RegExp(escapeRegex(search), "i");
//     filter.$or = [{ name: pattern }, { body: pattern }];
//   }

//   const [templates, total, summary] = await Promise.all([
//     Template.find(filter)
//       .sort({ createdAt: -1, _id: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean(),
//     Template.countDocuments(filter),
//     getSummary(organizationId)
//   ]);

//   return {
//     templates: templates.map(toTemplateDto),
//     summary,
//     pagination: {
//       page,
//       limit,
//       total,
//       totalPages: Math.max(1, Math.ceil(total / limit))
//     }
//   };
// }

// export async function getTemplate(organizationId, templateId) {
//   const template = await findTemplateDoc(organizationId, templateId);
//   return toTemplateDto(template);
// }

// /* ------------------------------ SUBMIT TO META ------------------------------ */

// export async function submitTemplate(organizationId, templateId) {
//   const template = await findTemplateDoc(organizationId, templateId);

//   if (template.status !== "DRAFT") {
//     throw httpError(
//       `Only draft templates can be submitted (this one is ${template.status})`,
//       409
//     );
//   }

//   if (template.category === "AUTHENTICATION") {
//     throw httpError(
//       "Authentication templates use Meta's fixed OTP format, which is not supported yet. Use Utility or Marketing.",
//       400
//     );
//   }

//   assertMetaConfigured();

//   let headerHandle;

//   if (template.type !== "TEXT") {
//     if (!template.headerMedia?.fileName) {
//       throw httpError("This template has no header file to submit", 400);
//     }

//     headerHandle = await uploadHeaderSample({
//       filePath: path.join(TEMPLATE_UPLOAD_DIR, template.headerMedia.fileName),
//       mimeType: template.headerMedia.mimeType,
//       fileName: template.headerMedia.originalName || template.headerMedia.fileName
//     });
//   }

//   const result = await createMetaTemplate(template, headerHandle);

//   template.metaTemplateId = String(result.id || "");
//   template.status = String(result.status || "PENDING").toUpperCase();
//   template.submittedAt = new Date();
//   template.rejectionReason = "";
//   await template.save();

//   return toTemplateDto(template);
// }

// /* ------------------------------ CREATE ------------------------------ */

// export async function createTemplate(organizationId, userId, data, file) {
//   let template;

//   try {
//     template = await Template.create({
//       organizationId,
//       createdBy: userId,
//       name: data.name,
//       language: data.language,
//       type: data.type,
//       category: data.category,
//       body: data.body,
//       footer: data.footer,
//       placeholderExamples: data.placeholderExamples,
//       variableCount: data.variableCount,
//       buttons: data.buttons.map((text) => ({ type: "QUICK_REPLY", text })),
//       headerMedia: file
//         ? {
//             originalName: file.originalname,
//             mimeType: file.mimetype,
//             size: file.size,
//             fileName: file.filename
//           }
//         : null,
//       status: "DRAFT",
//       source: "local"
//     });
//   } catch (error) {
//     if (error.code === 11000) {
//       throw httpError(
//         "A template with this name and language already exists",
//         409
//       );
//     }
//     throw error;
//   }

//   const result = {
//     template: toTemplateDto(template),
//     submission: { requested: data.submitForApproval, success: false, message: "" }
//   };

//   if (data.submitForApproval) {
//     try {
//       result.template = await submitTemplate(organizationId, template._id);
//       result.submission.success = true;
//       result.submission.message = "Submitted to Meta for approval";
//     } catch (error) {
//       // The template is saved as a draft; the user can submit it again later
//       result.submission.message = error.message;
//     }
//   }

//   return result;
// }

// /* ------------------------------ SYNC WITH META ------------------------------ */

// export async function syncTemplates(organizationId) {
//   assertMetaConfigured();

//   const fromMeta = (await listMetaTemplates()).map(mapMetaTemplate);
//   const syncedAt = new Date();

//   let created = 0;
//   let updated = 0;

//   if (fromMeta.length > 0) {
//     const result = await Template.bulkWrite(
//       fromMeta.map((meta) => {
//         const { name, language, ...fields } = meta;

//         return {
//           updateOne: {
//             filter: { organizationId, name, language },
//             update: {
//               $set: { ...fields, syncedAt },
//               $setOnInsert: { source: "meta", headerMedia: null }
//             },
//             upsert: true
//           }
//         };
//       })
//     );

//     created = result.upsertedCount ?? 0;
//     updated = result.modifiedCount ?? 0;
//   }

//   return {
//     fetched: fromMeta.length,
//     created,
//     updated,
//     summary: await getSummary(organizationId)
//   };
// }

// /* ------------------------------ DELETE ------------------------------ */

// export async function deleteTemplate(organizationId, templateId) {
//   const template = await findTemplateDoc(organizationId, templateId);

//   let metaDeleted = false;

//   // Delete on Meta first, so the template does not come back on the next sync
//   if (template.metaTemplateId && isMetaConfigured()) {
//     await deleteMetaTemplate({
//       name: template.name,
//       metaTemplateId: template.metaTemplateId
//     });
//     metaDeleted = true;
//   }

//   await Template.deleteOne({ _id: template._id });

//   if (template.headerMedia?.fileName) {
//     await fs
//       .unlink(path.join(TEMPLATE_UPLOAD_DIR, template.headerMedia.fileName))
//       .catch(() => {});
//   }

//   return {
//     metaDeleted,
//     // Tells the UI when a template that exists on Meta was only removed locally
//     note:
//       template.metaTemplateId && !metaDeleted
//         ? "Removed from this workspace only. WhatsApp is not connected, so it may return on the next sync."
//         : ""
//   };
// }



import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";

import Template from "../../models/Template.js";

import {
  TEMPLATE_UPLOAD_DIR,
  TEMPLATE_URL_PREFIX
} from "../../middleware/templateUpload.middleware.js";

import {
  assertMetaConfigured,
  isMetaConfigured,
  uploadHeaderSample,
  createMetaTemplate,
  listMetaTemplates,
  deleteMetaTemplate,
  mapMetaTemplate
} from "../../services/meta.service.js";

function httpError(message, statusCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) error.details = details;

  return error;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---------------- DTO ---------------- */

export function toTemplateDto(template) {
  const examples = template.placeholderExamples || [];
  const count = template.variableCount || 0;

  return {
    id: template._id,
    name: template.name,
    language: template.language,
    type: template.type,
    category: template.category,
    status: template.status,
    usableInCampaign: template.status === "APPROVED",
    body: template.body,

    previewText: template.body.replace(
      /\{\{\s*(\d+)\s*\}\}/g,
      (match, index) =>
        examples[Number(index) - 1] || match
    ),

    footer: template.footer,
    variableCount: count,

    variables: Array.from({ length: count }, (_, index) => ({
      key: `{{${index + 1}}}`,
      example: examples[index] || ""
    })),

    buttons: (template.buttons || []).map((button) => ({
      type: button.type,
      text: button.text
    })),

    headerMedia: template.headerMedia?.fileName
      ? {
          originalName: template.headerMedia.originalName,
          mimeType: template.headerMedia.mimeType,
          size: template.headerMedia.size,
          url: `${TEMPLATE_URL_PREFIX}/${template.headerMedia.fileName}`
        }
      : null,

    rejectionReason: template.rejectionReason,
    source: template.source,
    submittedAt: template.submittedAt,
    syncedAt: template.syncedAt,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };
}

async function getSummary(organizationId) {
  const rows = await Template.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  const by = Object.fromEntries(
    rows.map((row) => [row._id, row.count])
  );

  return {
    approved: by.APPROVED || 0,
    pending: by.PENDING || 0,
    rejected: by.REJECTED || 0,
    draft: by.DRAFT || 0,
    other: (by.PAUSED || 0) + (by.DISABLED || 0),
    total: rows.reduce((sum, row) => sum + row.count, 0)
  };
}

async function findTemplateDoc(organizationId, templateId) {
  if (!mongoose.isValidObjectId(templateId)) {
    throw httpError("Invalid template id", 400);
  }

  const template = await Template.findOne({
    _id: templateId,
    organizationId
  });

  if (!template) {
    throw httpError("Template not found", 404);
  }

  return template;
}

/* ---------------- LIST / GET ---------------- */

export async function listTemplates(
  organizationId,
  { page, limit, search, status, category }
) {
  const filter = { organizationId };

  if (status && status !== "ALL") {
    filter.status = status;
  }

  if (category) {
    filter.category = category;
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");

    filter.$or = [
      { name: pattern },
      { body: pattern }
    ];
  }

  const [templates, total, summary] = await Promise.all([
    Template.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Template.countDocuments(filter),
    getSummary(organizationId)
  ]);

  return {
    templates: templates.map(toTemplateDto),
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

export async function getTemplate(organizationId, templateId) {
  const template = await findTemplateDoc(
    organizationId,
    templateId
  );

  return toTemplateDto(template);
}

/* ---------------- SUBMIT TO META ---------------- */

export async function submitTemplate(organizationId, templateId) {
  const template = await findTemplateDoc(
    organizationId,
    templateId
  );

  if (template.status !== "DRAFT") {
    throw httpError(
      `Only draft templates can be submitted (this one is ${template.status})`,
      409
    );
  }

  if (template.category === "AUTHENTICATION") {
    throw httpError(
      "Authentication templates use Meta's fixed OTP format, which is not supported yet. Use Utility or Marketing.",
      400
    );
  }

  assertMetaConfigured();

  let headerHandle;

  if (template.type !== "TEXT") {
    if (!template.headerMedia?.fileName) {
      throw httpError(
        "This template has no header file to submit",
        400
      );
    }

    const filePath = path.join(
      TEMPLATE_UPLOAD_DIR,
      template.headerMedia.fileName
    );

    try {
      await fs.access(filePath);
    } catch {
      throw httpError(
        "The template header file is missing on the server. Upload it again before submitting.",
        400
      );
    }

    headerHandle = await uploadHeaderSample({
      filePath,
      mimeType: template.headerMedia.mimeType,
      fileName:
        template.headerMedia.originalName ||
        template.headerMedia.fileName
    });
  }

  let result;

  try {
    result = await createMetaTemplate(template, headerHandle);
  } catch (error) {
    // Keep the original message and details for the Express error handler.
    console.error("Template submission to Meta failed:", {
      templateId: String(template._id),
      templateName: template.name,
      message: error.message,
      details: error.details
    });

    throw error;
  }

  template.metaTemplateId = String(result.id || "");
  template.status = String(result.status || "PENDING").toUpperCase();
  template.submittedAt = new Date();
  template.rejectionReason = "";

  await template.save();

  return toTemplateDto(template);
}

/* ---------------- CREATE ---------------- */

export async function createTemplate(
  organizationId,
  userId,
  data,
  file
) {
  let template;

  try {
    template = await Template.create({
      organizationId,
      createdBy: userId,
      name: data.name,
      language: data.language,
      type: data.type,
      category: data.category,
      body: data.body,
      footer: data.footer,
      placeholderExamples: data.placeholderExamples,
      variableCount: data.variableCount,

      buttons: data.buttons.map((text) => ({
        type: "QUICK_REPLY",
        text
      })),

      headerMedia: file
        ? {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            fileName: file.filename
          }
        : null,

      status: "DRAFT",
      source: "local"
    });
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(
        "A template with this name and language already exists",
        409
      );
    }

    throw error;
  }

  const result = {
    template: toTemplateDto(template),
    submission: {
      requested: data.submitForApproval,
      success: false,
      message: ""
    }
  };

  if (data.submitForApproval) {
    try {
      result.template = await submitTemplate(
        organizationId,
        template._id
      );

      result.submission.success = true;
      result.submission.message = "Submitted to Meta for approval";
    } catch (error) {
      // The draft remains saved so the user can retry later.
      result.submission.message = error.message;
    }
  }

  return result;
}

/* ---------------- SYNC WITH META ---------------- */

export async function syncTemplates(organizationId) {
  assertMetaConfigured();

  const fromMeta = (
    await listMetaTemplates()
  ).map(mapMetaTemplate);

  const syncedAt = new Date();

  let created = 0;
  let updated = 0;

  if (fromMeta.length > 0) {
    const result = await Template.bulkWrite(
      fromMeta.map((meta) => {
        const { name, language, ...fields } = meta;

        return {
          updateOne: {
            filter: {
              organizationId,
              name,
              language
            },
            update: {
              $set: {
                ...fields,
                syncedAt
              },
              $setOnInsert: {
                source: "meta",
                headerMedia: null
              }
            },
            upsert: true
          }
        };
      })
    );

    created = result.upsertedCount ?? 0;
    updated = result.modifiedCount ?? 0;
  }

  return {
    fetched: fromMeta.length,
    created,
    updated,
    summary: await getSummary(organizationId)
  };
}

/* ---------------- DELETE ---------------- */

export async function deleteTemplate(
  organizationId,
  templateId
) {
  const template = await findTemplateDoc(
    organizationId,
    templateId
  );

  let metaDeleted = false;

  if (template.metaTemplateId && isMetaConfigured()) {
    await deleteMetaTemplate({
      name: template.name,
      metaTemplateId: template.metaTemplateId
    });

    metaDeleted = true;
  }

  await Template.deleteOne({
    _id: template._id,
    organizationId
  });

  if (template.headerMedia?.fileName) {
    await fs
      .unlink(
        path.join(
          TEMPLATE_UPLOAD_DIR,
          template.headerMedia.fileName
        )
      )
      .catch(() => {});
  }

  return {
    metaDeleted,
    note:
      template.metaTemplateId && !metaDeleted
        ? "Removed from this workspace only. WhatsApp is not connected, so it may return on the next sync."
        : ""
  };
}
