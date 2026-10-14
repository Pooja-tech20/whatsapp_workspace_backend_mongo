import { Router } from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { getStatus, sendMessage } from "./whatsapp.controller.js";

const router = Router();

router.use(protect);

router.get("/status", getStatus);
router.post("/test-message", sendMessage);

export default router;
