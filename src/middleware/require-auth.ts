import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error.js";
import { authService } from "../services/auth.service.js";

const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readBearerToken(header: string | undefined): string {
  if (header === undefined) {
    throw new HttpError(401, "Authentication required");
  }

  const [scheme, token, extra] = header.trim().split(" ");
  if (
    scheme?.toLowerCase() !== "bearer" ||
    token === undefined ||
    extra !== undefined ||
    !BEARER_TOKEN_PATTERN.test(token)
  ) {
    throw new HttpError(401, "Authentication required");
  }

  return token;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  req.authUser = await authService.authenticate(readBearerToken(req.header("authorization")));
  next();
};
