import { Router } from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { templateUpload } from "../../middleware/templateUpload.middleware.js";
import {
  getTemplates,
  getOneTemplate,
  addTemplate,
  submitOneTemplate,
  syncAllTemplates,
  removeTemplate
} from "./templates.controller.js";

const router = Router();

router.use(protect);

router.get("/", getTemplates);
router.post("/", templateUpload, addTemplate);

// Must stay above "/:id" routes
router.post("/sync", syncAllTemplates);

router.get("/:id", getOneTemplate);
router.post("/:id/submit", submitOneTemplate);
router.delete("/:id", removeTemplate);

export default router;