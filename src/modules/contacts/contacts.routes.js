import { Router } from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { csvUpload } from "../../middleware/upload.middleware.js";
import {
  getContacts,
  addContact,
  removeContact,
  importContacts
} from "./contacts.controller.js";

const router = Router();

// Every contacts route needs a logged-in user
router.use(protect);

router.get("/", getContacts);
router.post("/", addContact);
router.post("/import", csvUpload, importContacts);
router.delete("/:id", removeContact);

export default router;