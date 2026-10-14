import { Router } from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { getDestinations, postDestination, patchDestination, removeDestination, getHistory, runExport } from "./exports.controller.js";

const router = Router();
router.use(protect);
router.get("/destinations", getDestinations);
router.post("/destinations", postDestination);
router.patch("/destinations/:id", patchDestination);
router.delete("/destinations/:id", removeDestination);
router.get("/history", getHistory);
router.post("/run", runExport);
export default router;
