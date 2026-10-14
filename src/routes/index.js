import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import contactRoutes from "../modules/contacts/contacts.routes.js";
import listRoutes from "../modules/lists/lists.routes.js";
import templateRoutes from "../modules/templates/templates.routes.js";
import whatsappRoutes from "../modules/whatsapp/whatsapp.routes.js";
import webhookRoutes from "../modules/Webhooks/webhook.routes.js";
import campaignRoutes from "../modules/campaigns/campaigns.routes.js";
import inboxRoutes from "../modules/inbox/inbox.routes.js";
import channelRoutes from "../modules/channels/channels.routes.js";
import mediaRoutes from "../modules/media/media.routes.js";
import analyticsRoutes from "../modules/analytics/analytics.routes.js";
import automationRoutes from "../modules/automations/automations.routes.js";
import exportRoutes from "../modules/exports/exports.routes.js";

const router = Router();

// Public (Meta calls this; protected by signature check, not by login)
router.use("/webhooks", webhookRoutes);

// Authentication routes
router.use("/auth", authRoutes);
router.use("/contacts", contactRoutes);
router.use("/lists", listRoutes);
router.use("/templates", templateRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/inbox", inboxRoutes);
router.use("/channels", channelRoutes);
router.use("/media", mediaRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/automations", automationRoutes);
router.use("/exports", exportRoutes);

export default router;
