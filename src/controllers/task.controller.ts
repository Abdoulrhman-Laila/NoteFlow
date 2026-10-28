import type { RequestHandler } from "express";
import { taskService } from "../services/task.service.js";
import type { ApiSuccess } from "../types/api.js";
import type { Task } from "../types/task.js";
import { parseCreateTask, parseStatusQuery, parseTaskId, parseUpdateTask } from "../validation/task.validation.js";

export const listTasks: RequestHandler = (req, res) => {
  const status = parseStatusQuery(req.query.status);
  const data = status === undefined ? taskService.list() : taskService.list(status);
  const body: ApiSuccess<Task[]> = { success: true, data };
  res.json(body);
};

export const getTask: RequestHandler<{ id: string }> = (req, res) => {
  const data = taskService.getById(parseTaskId(req.params.id));
  const body: ApiSuccess<Task> = { success: true, data };
  res.json(body);
};

export const createTask: RequestHandler = (req, res) => {
  const data = taskService.create(parseCreateTask(req.body));
  const body: ApiSuccess<Task> = { success: true, data };
  res.status(201).json(body);
};

export const updateTask: RequestHandler<{ id: string }> = (req, res) => {
  const data = taskService.update(parseTaskId(req.params.id), parseUpdateTask(req.body));
  const body: ApiSuccess<Task> = { success: true, data };
  res.json(body);
};

export const deleteTask: RequestHandler<{ id: string }> = (req, res) => {
  taskService.remove(parseTaskId(req.params.id));
  res.status(204).send();
};
