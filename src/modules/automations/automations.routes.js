import { Router } from "express";
import { protect } from "../../middleware/auth.middleware.js";

import {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation
} from "./automations.controller.js";

const router = Router();

router.use(protect);

router.get("/", listAutomations);
router.post("/", createAutomation);
router.patch("/:id", updateAutomation);
router.delete("/:id", deleteAutomation);

export default router;