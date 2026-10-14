
import Campaign from "../../models/Campaign.js";
import CampaignRecipient from "../../models/CampaignRecipient.js";
import Organization from "../../models/Organization.js";
import { logger } from "../../config/logger.js";
import { sendTemplateToPhone } from "../../services/messaging.service.js";
import {
  assertSendConfigured,
  resolvePhoneNumberId
} from "../../services/whatsapp.service.js";

const CONCURRENCY = Math.max(
  1,
  Number(process.env.CAMPAIGN_CONCURRENCY) || 5
);
const CHUNK_DELAY_MS = Math.max(
  0,
  Number(process.env.CAMPAIGN_CHUNK_DELAY_MS ?? 500)
);
const MAX_CONSECUTIVE_FAILURES = Math.max(
  1,
  Number(process.env.CAMPAIGN_MAX_FAILURES) || 10
);
const BATCH_SIZE = 100;
const SCHEDULER_INTERVAL_MS = 30_000;

const running = new Set();
let schedulerTimer = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function resolveVariables(variables = [], recipient = {}) {
  const values = {
    name: recipient.name || recipient.firstName || "Customer",
    firstname: recipient.firstName || recipient.name || "Customer",
    lastname: recipient.lastName || "",
    phone: recipient.phone || ""
  };

  return variables.map((value) =>
    String(value ?? "").replace(
      /\{\{\s*(name|firstName|lastName|phone)\s*\}\}/gi,
      (_, key) => values[key.toLowerCase()] ?? ""
    )
  );
}

async function sendOne(campaign, organization, recipient) {
  const recipientFilter = {
    _id: recipient._id,
    organizationId: campaign.organizationId,
    campaignId: campaign._id,
    status: "PROCESSING"
  };

  try {
    const message = await sendTemplateToPhone({
      organization,
      userId: campaign.createdBy,
      phone: recipient.phone,
      templateId: campaign.templateId,
      variables: resolveVariables(campaign.variables, recipient),
      headerMediaUrl: campaign.headerMediaUrl || undefined,
      campaignId: campaign._id
    });

    await CampaignRecipient.updateOne(recipientFilter, {
      $set: {
        status: "SENT",
        messageId: message.id,
        processedAt: new Date(),
        error: ""
      }
    });

    return { ok: true };
  } catch (error) {
    const neverSent =
      !error.messageId &&
      [400, 409].includes(error.statusCode);

    await CampaignRecipient.updateOne(recipientFilter, {
      $set: {
        status: neverSent ? "SKIPPED" : "FAILED",
        messageId: error.messageId || null,
        processedAt: new Date(),
        error: String(error.message || "Send failed").slice(0, 500)
      }
    });

    return { ok: false, skipped: neverSent, error };
  }
}

async function failCampaign(campaignId, reason) {
  await Campaign.updateOne(
    { _id: campaignId, status: "RUNNING" },
    {
      $set: {
        status: "FAILED",
        failureReason: String(reason || "Campaign failed").slice(0, 500),
        completedAt: new Date()
      }
    }
  );
}

async function loop(campaignId) {
  const campaign = await Campaign.findById(campaignId).lean();

  if (!campaign || campaign.status !== "RUNNING") return;

  const organization = await Organization.findById(
    campaign.organizationId
  );

  if (!organization) {
    await failCampaign(campaignId, "Organization not found");
    return;
  }

  try {
    assertSendConfigured(resolvePhoneNumberId(organization));
  } catch (error) {
    await failCampaign(campaignId, error.message);
    return;
  }

  let consecutiveFailures = 0;

  while (true) {
    const batch = await CampaignRecipient.find({
      organizationId: campaign.organizationId,
      campaignId: campaign._id,
      status: "PENDING"
    })
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const current = await Campaign.findOne({
        _id: campaign._id,
        organizationId: campaign.organizationId
      })
        .select("status")
        .lean();

      if (!current || current.status !== "RUNNING") return;

      const chunk = batch.slice(i, i + CONCURRENCY);

      // Atomically claim each recipient. Only send recipients actually claimed.
      const claimed = await Promise.all(
        chunk.map((recipient) =>
          CampaignRecipient.findOneAndUpdate(
            {
              _id: recipient._id,
              organizationId: campaign.organizationId,
              campaignId: campaign._id,
              status: "PENDING"
            },
            { $set: { status: "PROCESSING" } },
            { new: true }
          ).lean()
        )
      );

      const recipientsToSend = claimed.filter(Boolean);

      const results = await Promise.all(
        recipientsToSend.map((recipient) =>
          sendOne(campaign, organization, recipient)
        )
      );

      for (const result of results) {
        if (result.ok) {
          consecutiveFailures = 0;
        } else if (!result.skipped) {
          consecutiveFailures += 1;
        }
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        const lastFailure = [...results]
          .reverse()
          .find((result) => result.error && !result.skipped)?.error;

        await failCampaign(
          campaign._id,
          `Stopped after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. ` +
            `Last error: ${lastFailure?.message || "unknown"}`
        );
        return;
      }

      if (CHUNK_DELAY_MS > 0) {
        await sleep(CHUNK_DELAY_MS);
      }
    }
  }

  const left = await CampaignRecipient.countDocuments({
    organizationId: campaign.organizationId,
    campaignId: campaign._id,
    status: { $in: ["PENDING", "PROCESSING"] }
  });

  if (left === 0) {
    await Campaign.updateOne(
      {
        _id: campaign._id,
        organizationId: campaign.organizationId,
        status: "RUNNING"
      },
      {
        $set: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      }
    );
  }
}

export async function runCampaign(campaignId) {
  const key = String(campaignId);

  if (running.has(key)) return;

  running.add(key);

  try {
    await loop(campaignId);
  } catch (error) {
    logger.error(
      { err: error, campaignId: key },
      "Campaign runner crashed"
    );

    await failCampaign(campaignId, error.message).catch((failureError) => {
      logger.error(
        { err: failureError, campaignId: key },
        "Could not mark campaign as failed"
      );
    });
  } finally {
    running.delete(key);
  }
}

async function startDueCampaigns() {
  while (true) {
    const campaign = await Campaign.findOneAndUpdate(
      {
        status: "SCHEDULED",
        scheduledAt: { $lte: new Date() }
      },
      {
        $set: {
          status: "RUNNING",
          startedAt: new Date(),
          failureReason: ""
        }
      },
      { new: true }
    );

    if (!campaign) break;

    // runCampaign handles and logs its own failures.
    void runCampaign(campaign._id);
  }
}

async function recoverInterrupted() {
  const interrupted = await Campaign.find({ status: "RUNNING" })
    .select("_id organizationId")
    .lean();

  for (const campaign of interrupted) {
    await CampaignRecipient.updateMany(
      {
        organizationId: campaign.organizationId,
        campaignId: campaign._id,
        status: "PROCESSING"
      },
      {
        $set: {
          status: "FAILED",
          error:
            "Interrupted by a server restart. Check delivery history before retrying.",
          processedAt: new Date()
        }
      }
    );

    void runCampaign(campaign._id);
  }
}

export async function startCampaignScheduler() {
  if (schedulerTimer) return;

  try {
    await recoverInterrupted();
    await startDueCampaigns();
  } catch (error) {
    logger.error({ err: error }, "Campaign recovery failed");
  }

  schedulerTimer = setInterval(() => {
    startDueCampaigns().catch((error) => {
      logger.error({ err: error }, "Campaign scheduler tick failed");
    });
  }, SCHEDULER_INTERVAL_MS);

  schedulerTimer.unref?.();
}

export function stopCampaignScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
}
