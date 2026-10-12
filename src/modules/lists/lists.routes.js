import { Router } from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { csvUpload } from "../../middleware/upload.middleware.js";
import {
  getLists,
  getOneList,
  addList,
  editList,
  removeList,
  getContactsInList,
  addContacts,
  removeContact,
  importIntoList
} from "./lists.controller.js";

const router = Router();

router.use(protect);

router.get("/", getLists);
router.post("/", addList);

router.get("/:id", getOneList);
router.patch("/:id", editList);
router.delete("/:id", removeList);

router.get("/:id/contacts", getContactsInList);
router.post("/:id/contacts", addContacts);
router.delete("/:id/contacts/:contactId", removeContact);

router.post("/:id/import", csvUpload, importIntoList);

export default router;