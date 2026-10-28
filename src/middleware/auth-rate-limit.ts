import rateLimit from "express-rate-limit";
import type { ApiError } from "../types/api.js";

const WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 5;

function createAuthRateLimit() {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: ATTEMPT_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      const body: ApiError = {
        success: false,
        message: "Too many attempts. Try again later.",
      };

      res.status(429).json(body);
    },
  });
}

export const registerRateLimit = createAuthRateLimit();
export const loginRateLimit = createAuthRateLimit();
