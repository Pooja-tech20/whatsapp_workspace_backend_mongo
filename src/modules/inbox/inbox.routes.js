import { Router } from "express";

import { protect } from "../../middleware/auth.middleware.js";
import {
  summary,
  getConversations,
  newConversation,
  getOneConversation,
  editConversation,
  getMessages,
  reply,
  sendTemplate,
  markRead,
  getMedia
} from "./inbox.controller.js";

const router = Router();

router.use(protect);

router.get("/summary", summary);

router.get("/conversations", getConversations);
router.post("/conversations", newConversation);

router.get("/conversations/:id", getOneConversation);
router.patch("/conversations/:id", editConversation);

router.get("/conversations/:id/messages", getMessages);
router.post("/conversations/:id/reply", reply);
router.post("/conversations/:id/template", sendTemplate);
router.post("/conversations/:id/read", markRead);

router.get("/messages/:id/media", getMedia);

export default router;
