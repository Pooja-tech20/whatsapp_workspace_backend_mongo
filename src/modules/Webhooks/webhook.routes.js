
import { Router } from "express";
import {
  verifyWebhook,
  receiveWebhook,
} from "./webhook.controller.js";

const router = Router();

router.get("/whatsapp", verifyWebhook);
router.post("/whatsapp", receiveWebhook);

export default router;
