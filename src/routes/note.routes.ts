import { Router } from "express";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "../controllers/note.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const noteRouter = Router();

noteRouter.use(requireAuth);
noteRouter.post("/", createNote);
noteRouter.get("/", listNotes);
noteRouter.get("/:id", getNote);
noteRouter.patch("/:id", updateNote);
noteRouter.delete("/:id", deleteNote);
