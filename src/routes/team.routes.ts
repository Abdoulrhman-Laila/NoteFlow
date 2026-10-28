import { Router } from "express";
import { addTeamMember, createTeam, listTeams } from "../controllers/team.controller.js";
import { createTeamNote, deleteTeamNote, listTeamNotes, updateTeamNote } from "../controllers/note.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const teamRouter = Router();

teamRouter.use(requireAuth);
teamRouter.post("/", createTeam);
teamRouter.get("/", listTeams);
teamRouter.post("/:id/members", addTeamMember);
teamRouter.post("/:id/notes", createTeamNote);
teamRouter.get("/:id/notes", listTeamNotes);
teamRouter.patch("/:id/notes/:noteId", updateTeamNote);
teamRouter.delete("/:id/notes/:noteId", deleteTeamNote);
