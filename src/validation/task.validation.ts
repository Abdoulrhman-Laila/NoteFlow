import { HttpError } from "../errors/http-error.js";
import { TASK_STATUSES, type CreateTaskInput, type TaskStatus, type UpdateTaskInput } from "../types/task.js";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.some((status) => status === value);
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

function readDescription(
  value: unknown,
  errors: Record<string, string>,
  allowNull: boolean,
): string | null | undefined {
  if (value === undefined) return undefined;

  if (value === null) {
    if (!allowNull) errors.description = "description must be a string";
    return allowNull ? null : undefined;
  }

  if (typeof value !== "string") {
    errors.description = "description must be a string";
    return undefined;
  }

  const description = value.trim();
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `description must be at most ${DESCRIPTION_MAX} characters`;
    return undefined;
  }

  return description.length === 0 ? null : description;
}

function readStatus(value: unknown, errors: Record<string, string>): TaskStatus | undefined {
  if (!isTaskStatus(value)) {
    errors.status = "status must be one of: todo, in_progress, done";
    return undefined;
  }

  return value;
}

export function parseStatusQuery(value: unknown): TaskStatus | undefined {
  if (value === undefined) return undefined;

  if (!isTaskStatus(value)) {
    throw new HttpError(400, "Validation failed", {
      status: "status must be one of: todo, in_progress, done",
    });
  }

  return value;
}

export function parseTaskId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;

  if (id === undefined || !UUID_PATTERN.test(id)) {
    throw new HttpError(400, "Validation failed", {
      id: "id must be a valid UUID",
    });
  }

  return id;
}

export function parseCreateTask(body: unknown): CreateTaskInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const errors: Record<string, string> = {};
  const title = readTitle(body.title, errors, true);
  const description = readDescription(body.description, errors, false);
  const status = body.status === undefined ? "todo" : readStatus(body.status, errors);

  if (hasErrors(errors) || title === undefined || status === undefined) {
    throw new HttpError(400, "Validation failed", errors);
  }

  const input: CreateTaskInput = { title, status };
  if (typeof description === "string") {
    input.description = description;
  }

  return input;
}

export function parseUpdateTask(body: unknown): UpdateTaskInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const errors: Record<string, string> = {};
  const title = readTitle(body.title, errors, false);
  const description = readDescription(body.description, errors, true);
  const status = body.status === undefined ? undefined : readStatus(body.status, errors);

  if (hasErrors(errors)) {
    throw new HttpError(400, "Validation failed", errors);
  }

  const input: UpdateTaskInput = {};
  if (title !== undefined) input.title = title;
  if (description !== undefined) input.description = description;
  if (status !== undefined) input.status = status;

  if (Object.keys(input).length === 0) {
    throw new HttpError(400, "Validation failed", {
      body: "at least one of title, description, or status is required",
    });
  }

  return input;
}
