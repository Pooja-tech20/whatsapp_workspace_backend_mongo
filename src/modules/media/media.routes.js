
import { Router } from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { mediaUpload } from "../../middleware/mediaUpload.middleware.js";
import {
  getMedia,
  uploadMedia,
  removeMedia
} from "./media.controller.js";

const router = Router();

router.use(protect);

router.get("/", getMedia);
router.post("/", mediaUpload, uploadMedia);
router.delete("/:id", removeMedia);

export default router;
