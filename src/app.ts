import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy);
  app.use(securityHeaders);
  app.use(
    cors({
      origin(origin, callback) {
        if (origin === undefined || origin === "") {
          callback(null, true);
          return;
        }

        callback(null, env.corsOrigins.includes(origin));
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
