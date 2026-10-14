
import { Router } from "express";

import { protect } from "../../middleware/auth.middleware.js";

import {
  getChannels,
  getOneChannel,
  addChannel,
  editChannel,
  removeChannel
} from "./channels.controller.js";

const router = Router();

router.use(protect);

router.get("/", getChannels);
router.post("/", addChannel);
router.get("/:id", getOneChannel);
router.patch("/:id", editChannel);
router.delete("/:id", removeChannel);

export default router;
