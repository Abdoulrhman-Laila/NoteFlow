import { randomUUID } from "node:crypto";
import { HttpError } from "../errors/http-error.js";
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from "../types/task.js";

const tasks = new Map<string, Task>();

function sortByNewest(items: Task[]): Task[] {
  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export const taskService = {
  list(status?: TaskStatus): Task[] {
    const items = [...tasks.values()];
    const filtered = status === undefined ? items : items.filter((task) => task.status === status);
    return sortByNewest(filtered);
  },

  getById(id: string): Task {
    const task = tasks.get(id);
    if (task === undefined) {
      throw new HttpError(404, "Task not found");
    }

    return task;
  },

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };

    tasks.set(task.id, task);
    return task;
  },

  update(id: string, input: UpdateTaskInput): Task {
    const current = this.getById(id);
    const updated: Task = {
      ...current,
      updatedAt: new Date().toISOString(),
    };

    if (input.title !== undefined) updated.title = input.title;
    if (input.description !== undefined) updated.description = input.description;
    if (input.status !== undefined) updated.status = input.status;

    tasks.set(id, updated);
    return updated;
  },

  remove(id: string): void {
    this.getById(id);
    tasks.delete(id);
  },
};
