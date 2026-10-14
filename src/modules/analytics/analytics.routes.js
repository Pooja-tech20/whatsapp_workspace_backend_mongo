
import { Router } from "express";
import { protect } from "../../middleware/auth.middleware.js";

import {
  getTypes,
  getFilters,
  getReports,
  postReport,
  getOneReport,
  patchReport,
  deleteReport,
  runReport
} from "./analytics.controller.js";

const router = Router();

router.use(protect);

router.get("/reports/types", getTypes);
router.get("/filters", getFilters);

router.get("/reports", getReports);
router.post("/reports", postReport);
router.get("/reports/:id", getOneReport);
router.patch("/reports/:id", patchReport);
router.delete("/reports/:id", deleteReport);
router.get("/reports/:id/run", runReport);

export default router;
