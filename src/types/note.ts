export interface Note {
  id: number;
  title: string;
  content: string;
  createdBy: number;
  teamId: number | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title: string;
  content?: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  isPinned?: boolean;
  isArchived?: boolean;
}

export interface StoredNote {
  id: number;
  title: string;
  content: string;
  createdBy: number;
  teamId: number | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toNote(note: StoredNote): Note {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    createdBy: note.createdBy,
    teamId: note.teamId,
    isPinned: note.isPinned,
    isArchived: note.isArchived,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
