import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import { prisma } from "../src/lib/prisma.js";

export function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      assert.equal(actual, expected);
    },
  };
}

export function api(app: Express) {
  return request(app);
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function dataOf(json: unknown): unknown {
  return isRecord(json) ? json.data : undefined;
}

export function successEnvelope(json: unknown): boolean {
  return isRecord(json) && json.success === true && "data" in json;
}

export function errorEnvelope(json: unknown, message?: string): boolean {
  if (!isRecord(json) || json.success !== false || typeof json.message !== "string") return false;
  if (message !== undefined && json.message !== message) return false;
  if ("errors" in json && json.errors !== undefined && !isRecord(json.errors)) return false;
  return true;
}

export function hasErrorField(json: unknown, field: string): boolean {
  return isRecord(json) && isRecord(json.errors) && typeof json.errors[field] === "string";
}

export function isUser(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.createdAt === "string" &&
    !("password" in value) &&
    !("passwordHash" in value)
  );
}

export function isSession(value: unknown): value is { user: Record<string, unknown>; token: string } {
  return isRecord(value) && isUser(value.user) && typeof value.token === "string" && value.token.length === 43;
}

export function isNote(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    typeof value.createdBy === "number" &&
    (value.teamId === null || typeof value.teamId === "number") &&
    typeof value.isPinned === "boolean" &&
    typeof value.isArchived === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function isTeam(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    typeof value.createdBy === "number" &&
    (value.role === "OWNER" || value.role === "ADMIN" || value.role === "MEMBER") &&
    typeof value.createdAt === "string"
  );
}

export function isListedMember(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.teamId === "number" &&
    typeof value.userId === "number" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    (value.role === "OWNER" || value.role === "ADMIN" || value.role === "MEMBER") &&
    typeof value.joinedAt === "string"
  );
}

export async function deleteFixtures(emails: string[]): Promise<void> {
  await prisma.note.deleteMany({ where: { creator: { email: { in: emails } } } });
  await prisma.team.deleteMany({ where: { creator: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
