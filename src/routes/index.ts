import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { healthRouter } from "./health.routes.js";
import { noteRouter } from "./note.routes.js";
import { taskRouter } from "./task.routes.js";
import { teamRouter } from "./team.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/v1/auth", authRouter);
apiRouter.use("/v1/notes", noteRouter);
apiRouter.use("/v1/teams", teamRouter);
apiRouter.use("/tasks", taskRouter);
