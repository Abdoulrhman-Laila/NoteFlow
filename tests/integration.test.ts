import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { hashSessionToken } from "../src/utils/token.js";
import { api, bearer, deleteFixtures, disconnectDb, expect, isRecord } from "./helpers.js";

process.env.NODE_ENV = "test";

const stamp = Date.now();
const password = "correct-horse";
const emails = [`it-owner-${stamp}@example.com`, `it-member-${stamp}@example.com`] as const;
const [ownerEmail, memberEmail] = emails;

const app = createApp();

let ownerToken = "";
let memberToken = "";
let ownerId = 0;
let memberId = 0;
let noteId = 0;
let teamId = 0;
let teamNoteId = 0;

describe("Integration Testing", () => {
  before(async () => {
    await deleteFixtures([...emails]);
  });

  after(async () => {
    await deleteFixtures([...emails]);
    await disconnectDb();
  });

  it("reaches PostgreSQL through Prisma", async () => {
    const dbPing = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1::int AS ok`;
    expect(dbPing[0]?.ok).toBe(1);
  });

  it("stops unauthenticated requests at middleware", async () => {
    const blocked = await api(app).get("/api/v1/notes");
    expect(blocked.status).toBe(401);
    expect(isRecord(blocked.body) && blocked.body.message === "Authentication required").toBe(true);
  });

  it("persists register through service to users and sessions", async () => {
    const register = await api(app).post("/api/v1/auth/register").send({
      name: "Owner",
      email: `  ${ownerEmail.toUpperCase()}  `,
      password,
      userId: 999999,
    });
    const registerData = register.body.data as unknown;
    ownerToken = isRecord(registerData) ? String(registerData.token) : "";
    ownerId = isRecord(registerData) && isRecord(registerData.user) ? Number(registerData.user.id) : 0;
    expect(register.status === 201 && ownerId > 0 && ownerToken.length === 43).toBe(true);

    const dbUser = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    expect(dbUser !== null && dbUser.id === ownerId && dbUser.email === ownerEmail && dbUser.name === "Owner").toBe(true);
    expect(dbUser !== null && dbUser.passwordHash.startsWith("scrypt$") && !dbUser.passwordHash.includes(password)).toBe(
      true,
    );

    const hashed = hashSessionToken(ownerToken);
    const dbSession = await prisma.session.findUnique({
      where: { tokenHash: hashed },
      select: { userId: true, tokenHash: true, expiresAt: true },
    });
    expect(
      dbSession !== null && dbSession.userId === ownerId && dbSession.tokenHash === hashed && dbSession.expiresAt > new Date(),
    ).toBe(true);

    const rawTokenRow = await prisma.session.findFirst({
      where: { userId: ownerId, tokenHash: ownerToken },
      select: { id: true },
    });
    expect(rawTokenRow).toBe(null);

    const memberReg = await api(app).post("/api/v1/auth/register").send({
      name: "Member",
      email: memberEmail,
      password,
    });
    memberToken = isRecord(memberReg.body.data) ? String(memberReg.body.data.token) : "";
    memberId =
      isRecord(memberReg.body.data) && isRecord(memberReg.body.data.user) ? Number(memberReg.body.data.user.id) : 0;
    expect(memberReg.status === 201 && memberId > 0).toBe(true);

    const me = await api(app).get("/api/v1/auth/me").set(bearer(ownerToken));
    const meUser = isRecord(me.body.data) ? me.body.data.user : undefined;
    expect(me.status === 200 && isRecord(meUser) && meUser.id === ownerId && meUser.email === ownerEmail).toBe(true);
  });

  it("writes personal notes from the session, not the body", async () => {
    const note = await api(app).post("/api/v1/notes").set(bearer(ownerToken)).send({
      title: "Integration note",
      userId: 999999,
      teamId: 999999,
      createdBy: memberId,
    });
    const noteData = note.body.data as unknown;
    noteId = isRecord(noteData) ? Number(noteData.id) : 0;
    expect(note.status === 201 && noteId > 0).toBe(true);

    const dbNote = await prisma.note.findUnique({
      where: { id: noteId },
      select: { title: true, createdBy: true, teamId: true },
    });
    expect(dbNote !== null && dbNote.title === "Integration note" && dbNote.createdBy === ownerId && dbNote.teamId === null).toBe(
      true,
    );

    const listed = await api(app).get("/api/v1/notes").set(bearer(ownerToken));
    const listedData = listed.body.data as unknown;
    expect(
      listed.status === 200 &&
        Array.isArray(listedData) &&
        listedData.some((item) => isRecord(item) && item.id === noteId && item.title === "Integration note"),
    ).toBe(true);
  });

  it("creates a team and OWNER membership in one transaction", async () => {
    const team = await api(app).post("/api/v1/teams").set(bearer(ownerToken)).send({ name: "Writers", createdBy: 999999 });
    const teamData = team.body.data as unknown;
    teamId = isRecord(teamData) ? Number(teamData.id) : 0;
    expect(team.status === 201 && teamId > 0).toBe(true);

    const dbTeam = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true, createdBy: true },
    });
    const dbOwnerMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: ownerId } },
      select: { role: true },
    });
    expect(dbTeam !== null && dbTeam.createdBy === ownerId && dbOwnerMember?.role === "OWNER").toBe(true);
  });

  it("persists membership, team notes, and role changes in PostgreSQL", async () => {
    const addMember = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: memberEmail, role: "MEMBER" });
    expect(addMember.status).toBe(201);

    const dbMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberId } },
      select: { role: true },
    });
    expect(dbMember?.role).toBe("MEMBER");

    const teamNote = await api(app).post(`/api/v1/teams/${teamId}/notes`).set(bearer(memberToken)).send({
      title: "Team row",
      teamId: 1,
      userId: ownerId,
    });
    const teamNoteData = teamNote.body.data as unknown;
    teamNoteId = isRecord(teamNoteData) ? Number(teamNoteData.id) : 0;

    const dbTeamNote = await prisma.note.findUnique({
      where: { id: teamNoteId },
      select: { teamId: true, createdBy: true, title: true },
    });
    expect(
      dbTeamNote !== null &&
        dbTeamNote.teamId === teamId &&
        dbTeamNote.createdBy === memberId &&
        dbTeamNote.title === "Team row",
    ).toBe(true);

    const promote = await api(app)
      .patch(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set(bearer(ownerToken))
      .send({ role: "ADMIN", userId: 1 });
    const dbPromoted = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberId } },
      select: { role: true },
    });
    expect(promote.status).toBe(200);
    expect(dbPromoted?.role).toBe("ADMIN");
  });

  it("deletes membership without removing the member's team note", async () => {
    const removed = await api(app).delete(`/api/v1/teams/${teamId}/members/${memberId}`).set(bearer(ownerToken));
    const dbRemoved = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberId } },
      select: { userId: true },
    });
    expect(removed.status).toBe(204);
    expect(dbRemoved).toBe(null);

    const leftoverNote = await prisma.note.findUnique({
      where: { id: teamNoteId },
      select: { id: true, teamId: true },
    });
    expect(leftoverNote !== null && leftoverNote.teamId === teamId).toBe(true);
  });

  it("cascades team delete and leaves personal notes", async () => {
    const deletedTeam = await api(app).delete(`/api/v1/teams/${teamId}`).set(bearer(ownerToken));
    expect(deletedTeam.status).toBe(204);

    const dbTeamGone = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    const dbMembersGone = await prisma.teamMember.count({ where: { teamId } });
    const dbTeamNotesGone = await prisma.note.count({ where: { teamId } });
    expect(dbTeamGone === null && dbMembersGone === 0 && dbTeamNotesGone === 0).toBe(true);

    const personalStill = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, teamId: true },
    });
    expect(personalStill !== null && personalStill.teamId === null).toBe(true);
  });

  it("logout deletes the session row so middleware rejects the token", async () => {
    const logout = await api(app).post("/api/v1/auth/logout").set(bearer(ownerToken));
    const dbSessionGone = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(ownerToken) },
      select: { id: true },
    });
    expect(logout.status).toBe(204);
    expect(dbSessionGone).toBe(null);

    const meAfter = await api(app).get("/api/v1/auth/me").set(bearer(ownerToken));
    expect(meAfter.status).toBe(401);
  });
});
