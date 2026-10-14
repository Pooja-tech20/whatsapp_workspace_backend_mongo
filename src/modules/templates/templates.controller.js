// import {
//   parseTemplateInput,
//   listQuerySchema
// } from "./templates.schema.js";
// import {
//   listTemplates,
//   getTemplate,
//   createTemplate,
//   submitTemplate,
//   syncTemplates,
//   deleteTemplate
// } from "./templates.service.js";
// import { discardUpload } from "../../middleware/templateUpload.middleware.js";

// export async function getTemplates(req, res, next) {
//   try {
//     const query = listQuerySchema.parse(req.query);
//     const data = await listTemplates(req.organization._id, query);

//     res.status(200).json({ success: true, data });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function getOneTemplate(req, res, next) {
//   try {
//     const template = await getTemplate(req.organization._id, req.params.id);

//     res.status(200).json({ success: true, data: { template } });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function addTemplate(req, res, next) {
//   try {
//     const data = parseTemplateInput(req.body, req.file);
//     const result = await createTemplate(
//       req.organization._id,
//       req.user._id,
//       data,
//       req.file
//     );

//     res.status(201).json({
//       success: true,
//       message: result.submission.success
//         ? "Template saved and submitted for approval"
//         : "Template saved",
//       data: result
//     });
//   } catch (error) {
//     await discardUpload(req.file);
//     next(error);
//   }
// }

// export async function submitOneTemplate(req, res, next) {
//   try {
//     const template = await submitTemplate(req.organization._id, req.params.id);

//     res.status(200).json({
//       success: true,
//       message: "Template submitted to Meta for approval",
//       data: { template }
//     });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function syncAllTemplates(req, res, next) {
//   try {
//     const data = await syncTemplates(req.organization._id);

//     res.status(200).json({
//       success: true,
//       message: `Synced ${data.fetched} templates from Meta`,
//       data
//     });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function removeTemplate(req, res, next) {
//   try {
//     const data = await deleteTemplate(req.organization._id, req.params.id);

//     res.status(200).json({
//       success: true,
//       message: "Template deleted",
//       data
//     });
//   } catch (error) {
//     next(error);
//   }
// }


import {
  parseTemplateInput,
  listQuerySchema
} from "./templates.schema.js";

import {
  listTemplates,
  getTemplate,
  createTemplate,
  submitTemplate,
  syncTemplates,
  deleteTemplate
} from "./templates.service.js";

import {
  discardUpload
} from "../../middleware/templateUpload.middleware.js";

export async function getTemplates(req, res, next) {
  try {
    const query = listQuerySchema.parse(req.query);
    const data = await listTemplates(req.organization._id, query);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return next(error);
  }
}

export async function getOneTemplate(req, res, next) {
  try {
    const template = await getTemplate(
      req.organization._id,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: { template }
    });
  } catch (error) {
    return next(error);
  }
}

export async function addTemplate(req, res, next) {
  try {
    const data = parseTemplateInput(req.body, req.file);

    const result = await createTemplate(
      req.organization._id,
      req.user._id,
      data,
      req.file
    );

    return res.status(201).json({
      success: true,
      message: result.submission.success
        ? "Template saved and submitted for approval"
        : "Template saved",
      data: result
    });
  } catch (error) {
    try {
      await discardUpload(req.file);
    } catch (cleanupError) {
      console.error(
        "Template upload cleanup failed:",
        cleanupError.message
      );
    }

    return next(error);
  }
}

export async function submitOneTemplate(req, res, next) {
  try {
    const template = await submitTemplate(
      req.organization._id,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Template submitted to Meta for approval",
      data: { template }
    });
  } catch (error) {
    return next(error);
  }
}

export async function syncAllTemplates(req, res, next) {
  try {
    const data = await syncTemplates(req.organization._id);

    return res.status(200).json({
      success: true,
      message: `Synced ${data.fetched} templates from Meta`,
      data
    });
  } catch (error) {
    return next(error);
  }
}

export async function removeTemplate(req, res, next) {
  try {
    const data = await deleteTemplate(
      req.organization._id,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Template deleted",
      data
    });
  } catch (error) {
    return next(error);
  }
}
