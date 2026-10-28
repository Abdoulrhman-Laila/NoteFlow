import { Router } from "express";
import type { ApiSuccess } from "../types/api.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const body: ApiSuccess<{ status: "ok" }> = {
    success: true,
    data: { status: "ok" },
  };

  res.json(body);
});
