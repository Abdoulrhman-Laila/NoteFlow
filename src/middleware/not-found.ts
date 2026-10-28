import type { RequestHandler } from "express";
import type { ApiError } from "../types/api.js";

export const notFound: RequestHandler = (req, res) => {
  const body: ApiError = {
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  };

  res.status(404).json(body);
};
