import { HttpError } from "../errors/http-error.js";
import type { AddTeamMemberInput, AssignableTeamRole, CreateTeamInput, UpdateMemberRoleInput } from "../types/team.js";
import { normalizeEmail } from "../utils/email.js";

const NAME_MAX = 150;
const EMAIL_MAX = 255;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ASSIGNABLE_ROLES: readonly AssignableTeamRole[] = ["ADMIN", "MEMBER"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCreateTeam(body: unknown): CreateTeamInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  if (typeof body.name !== "string") {
    throw new HttpError(400, "Validation failed", { name: "name is required" });
  }

  const name = body.name.trim();
  if (name.length === 0) {
    throw new HttpError(400, "Validation failed", { name: "name is required" });
  }

  if (name.length > NAME_MAX) {
    throw new HttpError(400, "Validation failed", { name: `name must be at most ${NAME_MAX} characters` });
  }

  return { name };
}

export function parseTeamId(value: string | string[] | undefined): number {
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

export function parseUserId(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) {
    throw new HttpError(400, "Validation failed", { userId: "userId must be a positive integer" });
  }

  const userId = Number(raw);
  if (!Number.isSafeInteger(userId)) {
    throw new HttpError(400, "Validation failed", { userId: "userId must be a positive integer" });
  }

  return userId;
}

function isAssignableRole(value: unknown): value is AssignableTeamRole {
  return typeof value === "string" && ASSIGNABLE_ROLES.some((role) => role === value);
}

export function parseAddTeamMember(body: unknown): AddTeamMemberInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const errors: Record<string, string> = {};
  let email: string | undefined;

  if (typeof body.email !== "string") {
    errors.email = "email is required";
  } else {
    email = normalizeEmail(body.email);
    if (email.length === 0 || email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
      errors.email = "email must be a valid email address";
      email = undefined;
    }
  }

  if (!isAssignableRole(body.role)) {
    errors.role = "role must be ADMIN or MEMBER";
  }

  if (Object.keys(errors).length > 0 || email === undefined || !isAssignableRole(body.role)) {
    throw new HttpError(400, "Validation failed", errors);
  }

  return { email, role: body.role };
}

export function parseUpdateMemberRole(body: unknown): UpdateMemberRoleInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  if (!isAssignableRole(body.role)) {
    throw new HttpError(400, "Validation failed", { role: "role must be ADMIN or MEMBER" });
  }

  return { role: body.role };
}
