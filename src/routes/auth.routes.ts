import { Router } from "express";
import { login, logout, me, register } from "../controllers/auth.controller.js";
import { loginRateLimit, registerRateLimit } from "../middleware/auth-rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";

export const authRouter = Router();

authRouter.post("/register", registerRateLimit, register);
authRouter.post("/login", loginRateLimit, login);
authRouter.get("/me", requireAuth, me);
authRouter.post("/logout", logout);
