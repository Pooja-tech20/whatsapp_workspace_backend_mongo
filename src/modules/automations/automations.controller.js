import {
  listAutomationsSchema,
  createAutomationSchema,
  updateAutomationSchema
} from "./automations.schema.js";

import {
  listAutomations as listService,
  createAutomation as createService,
  updateAutomation as updateService,
  deleteAutomation as deleteService
} from "./automations.service.js";

export async function listAutomations(req, res, next) {
  try {
    const query = listAutomationsSchema.parse(req.query);
    const data = await listService(req.organization._id, query);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createAutomation(req, res, next) {
  try {
    const input = createAutomationSchema.parse(req.body);

    const automation = await createService(
      req.organization._id,
      req.user._id,
      input
    );

    res.status(201).json({
      success: true,
      message: "Automation created",
      data: { automation }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAutomation(req, res, next) {
  try {
    const input = updateAutomationSchema.parse(req.body);
    const automation = await updateService(
      req.organization._id,
      req.params.id,
      input
    );

    res.status(200).json({
      success: true,
      message: "Automation updated",
      data: { automation }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAutomation(req, res, next) {
  try {
    await deleteService(req.organization._id, req.params.id);

    res.status(200).json({
      success: true,
      message: "Automation deleted"
    });
  } catch (error) {
    next(error);
  }
}