import { HttpError } from "../errors/http-error.js";
import type { LoginInput, RegisterInput } from "../types/user.js";
import { normalizeEmail } from "../utils/email.js";

const NAME_MAX = 100;
const EMAIL_MAX = 255;
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

function readName(value: unknown, errors: Record<string, string>): string | undefined {
  if (typeof value !== "string") {
    errors.name = "name is required";
    return undefined;
  }

  const name = value.trim();
  if (name.length === 0) {
    errors.name = "name is required";
    return undefined;
  }

  if (name.length > NAME_MAX) {
    errors.name = `name must be at most ${NAME_MAX} characters`;
    return undefined;
  }

  return name;
}

function readEmail(value: unknown, errors: Record<string, string>): string | undefined {
  if (typeof value !== "string") {
    errors.email = "email is required";
    return undefined;
  }

  const email = normalizeEmail(value);
  if (email.length === 0) {
    errors.email = "email is required";
    return undefined;
  }

  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    errors.email = "email must be a valid email address";
    return undefined;
  }

  return email;
}

function readPassword(value: unknown, errors: Record<string, string>): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    errors.password = "password is required";
    return undefined;
  }

  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    errors.password = `password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters`;
    return undefined;
  }

  return value;
}

export function parseRegister(body: unknown): RegisterInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const errors: Record<string, string> = {};
  const name = readName(body.name, errors);
  const email = readEmail(body.email, errors);
  const password = readPassword(body.password, errors);

  if (hasErrors(errors) || name === undefined || email === undefined || password === undefined) {
    throw new HttpError(400, "Validation failed", errors);
  }

  return { name, email, password };
}

export function parseLogin(body: unknown): LoginInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const errors: Record<string, string> = {};
  const email = readEmail(body.email, errors);
  const password = readPassword(body.password, errors);

  if (hasErrors(errors) || email === undefined || password === undefined) {
    throw new HttpError(400, "Validation failed", errors);
  }

  return { email, password };
}
