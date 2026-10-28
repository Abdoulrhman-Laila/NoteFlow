import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error.js";
import { readBearerToken } from "../middleware/require-auth.js";
import { authService } from "../services/auth.service.js";
import type { ApiSuccess } from "../types/api.js";
import type { AuthSession, PublicUser } from "../types/user.js";
import { parseLogin, parseRegister } from "../validation/auth.validation.js";

export const register: RequestHandler = async (req, res) => {
  const data = await authService.register(parseRegister(req.body));
  const body: ApiSuccess<AuthSession> = { success: true, data };
  res.status(201).json(body);
};

export const login: RequestHandler = async (req, res) => {
  const data = await authService.login(parseLogin(req.body));
  const body: ApiSuccess<AuthSession> = { success: true, data };
  res.status(200).json(body);
};

export const me: RequestHandler = (req, res) => {
  if (req.authUser === undefined) {
    throw new HttpError(401, "Authentication required");
  }

  const body: ApiSuccess<{ user: PublicUser }> = {
    success: true,
    data: { user: req.authUser },
  };
  res.status(200).json(body);
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(readBearerToken(req.header("authorization")));
  res.status(204).send();
};
