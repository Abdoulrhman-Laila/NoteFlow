import { HttpError } from "../errors/http-error.js";
import type { CreateNoteInput, UpdateNoteInput } from "../types/note.js";

const TITLE_MAX = 200;
const CONTENT_MAX = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

function readTitle(value: unknown, errors: Record<string, string>, required: boolean): string | undefined {
  if (value === undefined) {
    if (required) errors.title = "title is required";
    return undefined;
  }

  if (typeof value !== "string") {
    errors.title = "title must be a string";
    return undefined;
  }

  const title = value.trim();
  if (title.length === 0) {
    errors.title = "title is required";
    return undefined;
  }

  if (title.length > TITLE_MAX) {
    errors.title = `title must be at most ${TITLE_MAX} characters`;
    return undefined;
  }

  return title;
}

function readContent(value: unknown, errors: Record<string, string>): string | undefined {
  if (value === undefined) return undefined;

  if (typeof value !== "string") {
    errors.content = "content must be a string";
    return undefined;
  }

  if (value.length > CONTENT_MAX) {
    errors.content = `content must be at most ${CONTENT_MAX} characters`;
    return undefined;
  }

  return value;
}

function readBoolean(
  value: unknown,
  field: "isPinned" | "isArchived",
  errors: Record<string, string>,
): boolean | undefined {
  if (value === undefined) return undefined;

  if (typeof value !== "boolean") {
    errors[field] = `${field} must be a boolean`;
    return undefined;
  }

  return value;
}

export function parseNoteId(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) {
    throw new HttpError(400, "Validation failed", { id: "id must be a positive integer" });
  }

  const id = Number(raw);
  if (!Number.isSafeInteger(id)) {
    throw new HttpError(400, "Validation failed", { id: "id must be a positive integer" });
  }

  return id;
}

export function parseCreateNote(body: unknown): CreateNoteInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const errors: Record<string, string> = {};
  const title = readTitle(body.title, errors, true);
  const content = readContent(body.content, errors);

  if (hasErrors(errors) || title === undefined) {
    throw new HttpError(400, "Validation failed", errors);
  }

  const input: CreateNoteInput = { title };
  if (content !== undefined) {
    input.content = content;
  }

  return input;
}

export function parseUpdateNote(body: unknown): UpdateNoteInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const errors: Record<string, string> = {};
  const title = readTitle(body.title, errors, false);
  const content = readContent(body.content, errors);
  const isPinned = readBoolean(body.isPinned, "isPinned", errors);
  const isArchived = readBoolean(body.isArchived, "isArchived", errors);

  if (hasErrors(errors)) {
    throw new HttpError(400, "Validation failed", errors);
  }

  const input: UpdateNoteInput = {};
  if (title !== undefined) input.title = title;
  if (content !== undefined) input.content = content;
  if (isPinned !== undefined) input.isPinned = isPinned;
  if (isArchived !== undefined) input.isArchived = isArchived;

  if (Object.keys(input).length === 0) {
    throw new HttpError(400, "Validation failed", {
      body: "at least one of title, content, isPinned, or isArchived is required",
    });
  }

  return input;
}
