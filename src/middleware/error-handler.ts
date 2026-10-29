import type { ErrorRequestHandler } from "express";
import { HttpError } from "../errors/http-error.js";
import type { ApiError } from "../types/api.js";

function isInvalidJson(err: unknown): err is SyntaxError {
  if (!(err instanceof SyntaxError)) return false;

  const parseError = err as SyntaxError & { status?: number; type?: string };
  return parseError.type === "entity.parse.failed" || parseError.status === 400;
}

function logUnhandledError(error: unknown): void {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    console.error(`Unhandled error: ${error.code}`);
    return;
  }

  const name = error instanceof Error ? error.name : "Error";
  console.error(`Unhandled error: ${name}`);
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = {
      success: false,
      message: err.message,
    };

    if (err.details !== undefined) {
      body.errors = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  if (isInvalidJson(err)) {
    const body: ApiError = {
      success: false,
      message: "Request body must be valid JSON",
    };

    res.status(400).json(body);
    return;
  }

  logUnhandledError(err);

  const body: ApiError = {
    success: false,
    message: "Internal server error",
  };

  res.status(500).json(body);
};
