import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error.js";
import { noteService } from "../services/note.service.js";
import type { ApiSuccess } from "../types/api.js";
import type { Note } from "../types/note.js";
import type { PublicUser } from "../types/user.js";
import { parseCreateNote, parseNoteId, parseUpdateNote } from "../validation/note.validation.js";
import { parseTeamId } from "../validation/team.validation.js";

function requireUserId(user: PublicUser | undefined): number {
  if (user === undefined) {
    throw new HttpError(401, "Authentication required");
  }

  return user.id;
}

export const createNote: RequestHandler = async (req, res) => {
  const data = await noteService.create(requireUserId(req.authUser), parseCreateNote(req.body));
  const body: ApiSuccess<Note> = { success: true, data };
  res.status(201).json(body);
};

export const listNotes: RequestHandler = async (req, res) => {
  const data = await noteService.listPersonal(requireUserId(req.authUser));
  const body: ApiSuccess<Note[]> = { success: true, data };
  res.status(200).json(body);
};

export const getNote: RequestHandler<{ id: string }> = async (req, res) => {
  const data = await noteService.getPersonal(requireUserId(req.authUser), parseNoteId(req.params.id));
  const body: ApiSuccess<Note> = { success: true, data };
  res.status(200).json(body);
};

export const updateNote: RequestHandler<{ id: string }> = async (req, res) => {
  const data = await noteService.updatePersonal(
    requireUserId(req.authUser),
    parseNoteId(req.params.id),
    parseUpdateNote(req.body),
  );
  const body: ApiSuccess<Note> = { success: true, data };
  res.status(200).json(body);
};

export const deleteNote: RequestHandler<{ id: string }> = async (req, res) => {
  await noteService.deletePersonal(requireUserId(req.authUser), parseNoteId(req.params.id));
  res.status(204).send();
};

export const createTeamNote: RequestHandler<{ id: string }> = async (req, res) => {
  const data = await noteService.createForTeam(
    requireUserId(req.authUser),
    parseTeamId(req.params.id),
    parseCreateNote(req.body),
  );
  const body: ApiSuccess<Note> = { success: true, data };
  res.status(201).json(body);
};

export const listTeamNotes: RequestHandler<{ id: string }> = async (req, res) => {
  const data = await noteService.listForTeam(requireUserId(req.authUser), parseTeamId(req.params.id));
  const body: ApiSuccess<Note[]> = { success: true, data };
  res.status(200).json(body);
};

export const updateTeamNote: RequestHandler<{ id: string; noteId: string }> = async (req, res) => {
  const data = await noteService.updateForTeam(
    requireUserId(req.authUser),
    parseTeamId(req.params.id),
    parseNoteId(req.params.noteId),
    parseUpdateNote(req.body),
  );
  const body: ApiSuccess<Note> = { success: true, data };
  res.status(200).json(body);
};

export const deleteTeamNote: RequestHandler<{ id: string; noteId: string }> = async (req, res) => {
  await noteService.deleteForTeam(
    requireUserId(req.authUser),
    parseTeamId(req.params.id),
    parseNoteId(req.params.noteId),
  );
  res.status(204).send();
};
