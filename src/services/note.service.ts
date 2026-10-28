import { HttpError } from "../errors/http-error.js";
import { prisma } from "../lib/prisma.js";
import {
  toNote,
  type CreateNoteInput,
  type Note,
  type StoredNote,
  type UpdateNoteInput,
} from "../types/note.js";

const noteSelect = {
  id: true,
  title: true,
  content: true,
  createdBy: true,
  teamId: true,
  isPinned: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} as const;

function personalNoteWhere(userId: number, noteId: number) {
  return {
    id: noteId,
    createdBy: userId,
    teamId: null,
  };
}

export const noteService = {
  async create(userId: number, input: CreateNoteInput): Promise<Note> {
    const created: StoredNote = await prisma.note.create({
      data: {
        title: input.title,
        content: input.content ?? "",
        createdBy: userId,
        teamId: null,
      },
      select: noteSelect,
    });

    return toNote(created);
  },

  async listPersonal(userId: number): Promise<Note[]> {
    const notes: StoredNote[] = await prisma.note.findMany({
      where: {
        createdBy: userId,
        teamId: null,
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      select: noteSelect,
    });

    return notes.map((note) => toNote(note));
  },

  async createForTeam(userId: number, teamId: number, input: CreateNoteInput): Promise<Note> {
    await this.requireTeamMembership(userId, teamId);

    const created: StoredNote = await prisma.note.create({
      data: {
        title: input.title,
        content: input.content ?? "",
        createdBy: userId,
        teamId,
      },
      select: noteSelect,
    });

    return toNote(created);
  },

  async listForTeam(userId: number, teamId: number): Promise<Note[]> {
    await this.requireTeamMembership(userId, teamId);

    const notes: StoredNote[] = await prisma.note.findMany({
      where: { teamId },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      select: noteSelect,
    });

    return notes.map((note) => toNote(note));
  },

  async updateForTeam(
    userId: number,
    teamId: number,
    noteId: number,
    input: UpdateNoteInput,
  ): Promise<Note> {
    await this.requireTeamMembership(userId, teamId);

    const data: UpdateNoteInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.isPinned !== undefined) data.isPinned = input.isPinned;
    if (input.isArchived !== undefined) data.isArchived = input.isArchived;

    const updated = await prisma.note.updateManyAndReturn({
      where: { id: noteId, teamId },
      data,
      select: noteSelect,
    });
    const note = updated[0];

    if (note === undefined) {
      throw new HttpError(404, "Note not found");
    }

    return toNote(note);
  },

  async deleteForTeam(userId: number, teamId: number, noteId: number): Promise<void> {
    await this.requireTeamMembership(userId, teamId);

    const deleted = await prisma.note.deleteMany({
      where: { id: noteId, teamId },
    });

    if (deleted.count === 0) {
      throw new HttpError(404, "Note not found");
    }
  },

  async requireTeamMembership(userId: number, teamId: number): Promise<void> {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { teamId: true },
    });

    if (membership === null) {
      throw new HttpError(404, "Team not found");
    }
  },

  async getPersonal(userId: number, noteId: number): Promise<Note> {
    const note = await this.findPersonal(userId, noteId);
    return toNote(note);
  },

  async updatePersonal(userId: number, noteId: number, input: UpdateNoteInput): Promise<Note> {
    const data: UpdateNoteInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.isPinned !== undefined) data.isPinned = input.isPinned;
    if (input.isArchived !== undefined) data.isArchived = input.isArchived;

    const updated = await prisma.note.updateManyAndReturn({
      where: personalNoteWhere(userId, noteId),
      data,
      select: noteSelect,
    });
    const note = updated[0];

    if (note === undefined) {
      throw new HttpError(404, "Note not found");
    }

    return toNote(note);
  },

  async deletePersonal(userId: number, noteId: number): Promise<void> {
    const deleted = await prisma.note.deleteMany({
      where: personalNoteWhere(userId, noteId),
    });

    if (deleted.count === 0) {
      throw new HttpError(404, "Note not found");
    }
  },

  async findPersonal(userId: number, noteId: number): Promise<StoredNote> {
    const note = await prisma.note.findFirst({
      where: personalNoteWhere(userId, noteId),
      select: noteSelect,
    });

    if (note === null) {
      throw new HttpError(404, "Note not found");
    }

    return note;
  },
};
