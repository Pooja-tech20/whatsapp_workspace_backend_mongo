
import {
  listQuerySchema,
  createCampaignSchema,
  updateCampaignSchema,
  addRecipientsSchema,
  recipientsQuerySchema,
  messagesQuerySchema
} from "./campaigns.schema.js";

import {
  getSummary,
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  stopCampaign,
  retryFailed,
  addRecipients,
  listRecipients,
  getReport,
  listCampaignMessages
} from "./campaigns.service.js";

export async function summary(req, res, next) {
  try {
    const data = await getSummary(req.organization._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCampaigns(req, res, next) {
  try {
    const query = listQuerySchema.parse(req.query);
    const data = await listCampaigns(req.organization._id, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getOneCampaign(req, res, next) {
  try {
    const campaign = await getCampaign(
      req.organization._id,
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: { campaign }
    });
  } catch (error) {
    next(error);
  }
}

export async function addCampaign(req, res, next) {
  try {
    const input = createCampaignSchema.parse(req.body);
    const campaign = await createCampaign(
      req.organization,
      req.user._id,
      input
    );

    const message =
      campaign.status === "RUNNING"
        ? "Campaign created and started"
        : campaign.status === "SCHEDULED"
          ? "Campaign scheduled"
          : "Campaign saved as draft";

    res.status(201).json({
      success: true,
      message,
      data: { campaign }
    });
  } catch (error) {
    next(error);
  }
}

export async function editCampaign(req, res, next) {
  try {
    const input = updateCampaignSchema.parse(req.body);
    const campaign = await updateCampaign(
      req.organization._id,
      req.params.id,
      input
    );

    res.status(200).json({
      success: true,
      message: "Campaign updated",
      data: { campaign }
    });
  } catch (error) {
    next(error);
  }
}

export async function removeCampaign(req, res, next) {
  try {
    await deleteCampaign(req.organization._id, req.params.id);

    res.status(200).json({
      success: true,
      message: "Campaign deleted"
    });
  } catch (error) {
    next(error);
  }
}

export async function start(req, res, next) {
  try {
    const campaign = await startCampaign(
      req.organization,
      req.params.id
    );

    res.status(202).json({
      success: true,
      message: "Campaign started",
      data: { campaign }
    });
  } catch (error) {
    next(error);
  }
}

export async function stop(req, res, next) {
  try {
    const campaign = await stopCampaign(
      req.organization._id,
      req.params.id
    );

    res.status(200).json({
      success: true,
      message: "Campaign stopped",
      data: { campaign }
    });
  } catch (error) {
    next(error);
  }
}

export async function retry(req, res, next) {
  try {
    const campaign = await retryFailed(
      req.organization,
      req.params.id
    );

    res.status(202).json({
      success: true,
      message: "Retrying failed recipients",
      data: { campaign }
    });
  } catch (error) {
    next(error);
  }
}

export async function addCampaignRecipients(req, res, next) {
  try {
    const input = addRecipientsSchema.parse(req.body);
    const data = await addRecipients(
      req.organization._id,
      req.params.id,
      input
    );

    res.status(200).json({
      success: true,
      message: "Recipients added",
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getCampaignRecipients(req, res, next) {
  try {
    const query = recipientsQuerySchema.parse(req.query);
    const data = await listRecipients(
      req.organization._id,
      req.params.id,
      query
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function report(req, res, next) {
  try {
    const data = await getReport(
      req.organization._id,
      req.params.id
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const query = messagesQuerySchema.parse(req.query);
    const data = await listCampaignMessages(
      req.organization._id,
      req.params.id,
      query
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
