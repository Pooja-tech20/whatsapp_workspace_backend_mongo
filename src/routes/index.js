
import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import contactRoutes from "../modules/contacts/contacts.routes.js";
import listRoutes from "../modules/lists/lists.routes.js";
import templateRoutes from "../modules/templates/templates.routes.js";


const router = Router();

// Authentication routes
router.use("/auth", authRoutes);
router.use("/contacts", contactRoutes);
router.use("/lists", listRoutes);
router.use("/templates", templateRoutes);

export default router;
