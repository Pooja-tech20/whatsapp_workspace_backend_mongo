
import { Router } from "express";
import { protect } from "../../middleware/auth.middleware.js";

import {
  summary,
  getCampaigns,
  getOneCampaign,
  addCampaign,
  editCampaign,
  removeCampaign,
  start,
  stop,
  retry,
  addCampaignRecipients,
  getCampaignRecipients,
  report,
  getMessages
} from "./campaigns.controller.js";

const router = Router();

router.use(protect);

router.get("/", getCampaigns);
router.post("/", addCampaign);

// Keep static paths before "/:id".
router.get("/summary", summary);

router.get("/:id", getOneCampaign);
router.patch("/:id", editCampaign);
router.delete("/:id", removeCampaign);

router.post("/:id/start", start);
router.post("/:id/stop", stop);
router.post("/:id/retry-failed", retry);

router.get("/:id/recipients", getCampaignRecipients);
router.post("/:id/recipients", addCampaignRecipients);

router.get("/:id/report", report);
router.get("/:id/messages", getMessages);

export default router;
