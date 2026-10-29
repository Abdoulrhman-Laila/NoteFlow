import { Router } from "express";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeam,
  listTeamMembers,
  listTeams,
  removeTeamMember,
  updateTeam,
  updateTeamMember,
} from "../controllers/team.controller.js";
import { createTeamNote, deleteTeamNote, listTeamNotes, updateTeamNote } from "../controllers/note.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const teamRouter = Router();

teamRouter.use(requireAuth);
teamRouter.post("/", createTeam);
teamRouter.get("/", listTeams);
teamRouter.get("/:id", getTeam);
teamRouter.patch("/:id", updateTeam);
teamRouter.delete("/:id", deleteTeam);
teamRouter.get("/:id/members", listTeamMembers);
teamRouter.post("/:id/members", addTeamMember);
teamRouter.patch("/:id/members/:userId", updateTeamMember);
teamRouter.delete("/:id/members/:userId", removeTeamMember);
teamRouter.post("/:id/notes", createTeamNote);
teamRouter.get("/:id/notes", listTeamNotes);
teamRouter.patch("/:id/notes/:noteId", updateTeamNote);
teamRouter.delete("/:id/notes/:noteId", deleteTeamNote);
