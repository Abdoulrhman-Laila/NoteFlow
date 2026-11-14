import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import {
  api,
  bearer,
  dataOf,
  deleteFixtures,
  disconnectDb,
  errorEnvelope,
  expect,
  isListedMember,
  isNote,
  isRecord,
  isSession,
  isTeam,
  isUser,
  successEnvelope,
} from "./helpers.js";

const stamp = Date.now();
const password = "correct-horse";
const emails = [
  `fn-owner-${stamp}@example.com`,
  `fn-member-${stamp}@example.com`,
  `fn-outsider-${stamp}@example.com`,
] as const;
const [ownerEmail, memberEmail, outsiderEmail] = emails;

const app = createApp();

let ownerToken = "";
let memberToken = "";
let outsiderToken = "";
let ownerId = 0;
let memberId = 0;
let personalId = 0;
let teamId = 0;
let teamNoteId = 0;

process.env.NODE_ENV = "test";

describe("Functional Testing", () => {
  before(async () => {
    await deleteFixtures([...emails]);
  });

  after(async () => {
    await deleteFixtures([...emails]);
    await disconnectDb();
  });

  it("GET /api/health", async () => {
    const res = await api(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(successEnvelope(res.body) && isRecord(dataOf(res.body)) && dataOf(res.body)?.["status"] === "ok").toBe(true);
  });

  it("POST /register rejects a non-object body", async () => {
    const res = await api(app).post("/api/v1/auth/register").set("Content-Type", "application/json").send('"not-json"');
    expect(res.status).toBe(400);
    expect(errorEnvelope(res.body)).toBe(true);
  });

  it("POST /register validation", async () => {
    const res = await api(app).post("/api/v1/auth/register").send({
      name: "",
      email: "not-an-email",
      password: "short",
    });
    expect(res.status).toBe(400);
    expect(errorEnvelope(res.body, "Validation failed") && isRecord(res.body.errors)).toBe(true);
  });

  it("POST /register creates sessions", async () => {
    const ownerReg = await api(app).post("/api/v1/auth/register").send({
      name: "  Owner  ",
      email: `  ${ownerEmail.toUpperCase()}  `,
      password,
    });
    const ownerData = dataOf(ownerReg.body);
    expect(ownerReg.status).toBe(201);
    expect(successEnvelope(ownerReg.body) && isSession(ownerData)).toBe(true);
    expect(isSession(ownerData) && ownerData.user.email === ownerEmail).toBe(true);

    const memberReg = await api(app).post("/api/v1/auth/register").send({
      name: "Member",
      email: memberEmail,
      password,
    });
    const outsiderReg = await api(app).post("/api/v1/auth/register").send({
      name: "Outsider",
      email: outsiderEmail,
      password,
    });
    expect(memberReg.status === 201 && isSession(dataOf(memberReg.body))).toBe(true);
    expect(outsiderReg.status === 201 && isSession(dataOf(outsiderReg.body))).toBe(true);

    if (!isSession(ownerData) || !isSession(dataOf(memberReg.body)) || !isSession(dataOf(outsiderReg.body))) {
      throw new Error("Registration failed, cannot continue functional checks");
    }

    ownerToken = ownerData.token;
    memberToken = dataOf(memberReg.body).token;
    outsiderToken = dataOf(outsiderReg.body).token;
    ownerId = ownerData.user.id as number;
    memberId = dataOf(memberReg.body).user.id as number;
  });

  it("POST /register duplicate email", async () => {
    const res = await api(app).post("/api/v1/auth/register").send({
      name: "Owner",
      email: ownerEmail,
      password,
    });
    expect(res.status).toBe(409);
    expect(errorEnvelope(res.body, "Email is already registered")).toBe(true);
  });

  it("POST /login", async () => {
    const badLogin = await api(app).post("/api/v1/auth/login").send({
      email: ownerEmail,
      password: "wrong-password-here",
    });
    expect(badLogin.status).toBe(401);
    expect(errorEnvelope(badLogin.body, "Invalid email or password")).toBe(true);

    const unknownLogin = await api(app).post("/api/v1/auth/login").send({
      email: `missing-${stamp}@example.com`,
      password,
    });
    expect(unknownLogin.status).toBe(401);
    expect(errorEnvelope(unknownLogin.body, "Invalid email or password")).toBe(true);

    const login = await api(app).post("/api/v1/auth/login").send({
      email: ownerEmail,
      password,
    });
    expect(login.status).toBe(200);
    expect(successEnvelope(login.body) && isSession(dataOf(login.body))).toBe(true);
  });

  it("GET /me", async () => {
    const meNoAuth = await api(app).get("/api/v1/auth/me");
    expect(meNoAuth.status).toBe(401);
    expect(errorEnvelope(meNoAuth.body, "Authentication required")).toBe(true);

    const me = await api(app).get("/api/v1/auth/me").set(bearer(ownerToken));
    const meUser = isRecord(dataOf(me.body)) ? dataOf(me.body).user : undefined;
    expect(me.status === 200 && successEnvelope(me.body) && isUser(meUser)).toBe(true);
    expect(isRecord(meUser) && meUser.id === ownerId && meUser.email === ownerEmail).toBe(true);
  });

  it("personal notes", async () => {
    const personal = await api(app).post("/api/v1/notes").set(bearer(ownerToken)).send({
      title: "  Personal  ",
      content: "keep",
      userId: 999999,
      teamId: 999999,
    });
    expect(personal.status === 201 && successEnvelope(personal.body) && isNote(dataOf(personal.body))).toBe(true);
    const personalNote = dataOf(personal.body);
    expect(
      isRecord(personalNote) &&
        personalNote.createdBy === ownerId &&
        personalNote.teamId === null &&
        personalNote.title === "Personal",
    ).toBe(true);
    personalId = isRecord(personalNote) ? Number(personalNote.id) : 0;

    const emptyNote = await api(app).post("/api/v1/notes").set(bearer(ownerToken)).send({ title: "   " });
    expect(emptyNote.status === 400 && errorEnvelope(emptyNote.body, "Validation failed")).toBe(true);

    const listPersonal = await api(app).get("/api/v1/notes").set(bearer(ownerToken));
    expect(
      listPersonal.status === 200 &&
        successEnvelope(listPersonal.body) &&
        Array.isArray(dataOf(listPersonal.body)) &&
        (dataOf(listPersonal.body) as unknown[]).every(isNote) &&
        (dataOf(listPersonal.body) as Array<Record<string, unknown>>).every((note) => note.teamId === null),
    ).toBe(true);

    const getPersonal = await api(app).get(`/api/v1/notes/${personalId}`).set(bearer(ownerToken));
    expect(getPersonal.status === 200 && isNote(dataOf(getPersonal.body))).toBe(true);

    const otherGetPersonal = await api(app).get(`/api/v1/notes/${personalId}`).set(bearer(memberToken));
    expect(otherGetPersonal.status === 404 && errorEnvelope(otherGetPersonal.body, "Note not found")).toBe(true);

    const badNoteId = await api(app).get("/api/v1/notes/abc").set(bearer(ownerToken));
    expect(badNoteId.status === 400 && errorEnvelope(badNoteId.body, "Validation failed")).toBe(true);

    const emptyPatch = await api(app).patch(`/api/v1/notes/${personalId}`).set(bearer(ownerToken)).send({});
    expect(emptyPatch.status === 400 && errorEnvelope(emptyPatch.body, "Validation failed")).toBe(true);

    const patchPersonal = await api(app).patch(`/api/v1/notes/${personalId}`).set(bearer(ownerToken)).send({
      title: "Updated personal",
      isPinned: true,
      createdBy: 1,
    });
    expect(
      patchPersonal.status === 200 &&
        isRecord(dataOf(patchPersonal.body)) &&
        dataOf(patchPersonal.body)?.["title"] === "Updated personal" &&
        dataOf(patchPersonal.body)?.["isPinned"] === true &&
        dataOf(patchPersonal.body)?.["createdBy"] === ownerId,
    ).toBe(true);
  });

  it("teams and members", async () => {
    const team = await api(app).post("/api/v1/teams").set(bearer(ownerToken)).send({ name: "  Writers  ", createdBy: 999999 });
    expect(team.status === 201 && isTeam(dataOf(team.body))).toBe(true);
    expect(
      isRecord(dataOf(team.body)) &&
        dataOf(team.body)?.["name"] === "Writers" &&
        dataOf(team.body)?.["createdBy"] === ownerId &&
        dataOf(team.body)?.["role"] === "OWNER",
    ).toBe(true);
    teamId = isRecord(dataOf(team.body)) ? Number(dataOf(team.body).id) : 0;

    const blankTeam = await api(app).post("/api/v1/teams").set(bearer(ownerToken)).send({ name: "   " });
    expect(blankTeam.status === 400 && errorEnvelope(blankTeam.body, "Validation failed")).toBe(true);

    const listTeams = await api(app).get("/api/v1/teams").set(bearer(ownerToken));
    const outsiderTeams = await api(app).get("/api/v1/teams").set(bearer(outsiderToken));
    expect(
      listTeams.status === 200 && Array.isArray(dataOf(listTeams.body)) && (dataOf(listTeams.body) as unknown[]).length >= 1,
    ).toBe(true);
    expect(
      outsiderTeams.status === 200 &&
        Array.isArray(dataOf(outsiderTeams.body)) &&
        (dataOf(outsiderTeams.body) as unknown[]).length === 0,
    ).toBe(true);

    const getTeam = await api(app).get(`/api/v1/teams/${teamId}`).set(bearer(ownerToken));
    expect(getTeam.status === 200 && isTeam(dataOf(getTeam.body))).toBe(true);

    const outsiderGetTeam = await api(app).get(`/api/v1/teams/${teamId}`).set(bearer(outsiderToken));
    expect(outsiderGetTeam.status === 404 && errorEnvelope(outsiderGetTeam.body, "Team not found")).toBe(true);

    const renameDenied = await api(app).patch(`/api/v1/teams/${teamId}`).set(bearer(memberToken)).send({ name: "Nope" });
    expect(renameDenied.status === 404 && errorEnvelope(renameDenied.body, "Team not found")).toBe(true);

    const addOwnerRole = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: memberEmail, role: "OWNER" });
    expect(addOwnerRole.status === 400 && errorEnvelope(addOwnerRole.body, "Validation failed")).toBe(true);

    const addMissingUser = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: `ghost-${stamp}@example.com`, role: "MEMBER" });
    expect(addMissingUser.status === 404 && errorEnvelope(addMissingUser.body, "User not found")).toBe(true);

    const addMember = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: `  ${memberEmail.toUpperCase()}  `, role: "MEMBER" });
    expect(addMember.status).toBe(201);
    expect(
      isRecord(dataOf(addMember.body)) &&
        dataOf(addMember.body)?.["email"] === memberEmail &&
        dataOf(addMember.body)?.["role"] === "MEMBER" &&
        dataOf(addMember.body)?.["userId"] === memberId,
    ).toBe(true);

    const addDuplicate = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: memberEmail, role: "ADMIN" });
    expect(addDuplicate.status === 409 && errorEnvelope(addDuplicate.body, "User is already a team member")).toBe(true);

    const memberAdd = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(memberToken))
      .send({ email: outsiderEmail, role: "MEMBER" });
    expect(memberAdd.status === 403 && errorEnvelope(memberAdd.body, "Only the team owner can add members")).toBe(true);

    const outsiderAdd = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(outsiderToken))
      .send({ email: outsiderEmail, role: "MEMBER" });
    expect(outsiderAdd.status === 404 && errorEnvelope(outsiderAdd.body, "Team not found")).toBe(true);

    const members = await api(app).get(`/api/v1/teams/${teamId}/members`).set(bearer(memberToken));
    expect(
      members.status === 200 &&
        Array.isArray(dataOf(members.body)) &&
        (dataOf(members.body) as unknown[]).every(isListedMember) &&
        (dataOf(members.body) as Array<Record<string, unknown>>).map((row) => row.role).join(",") === "OWNER,MEMBER",
    ).toBe(true);

    const promote = await api(app)
      .patch(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set(bearer(ownerToken))
      .send({ role: "ADMIN", userId: 999999 });
    expect(
      promote.status === 200 &&
        isRecord(dataOf(promote.body)) &&
        dataOf(promote.body)?.["role"] === "ADMIN" &&
        dataOf(promote.body)?.["userId"] === memberId,
    ).toBe(true);

    const changeOwner = await api(app)
      .patch(`/api/v1/teams/${teamId}/members/${ownerId}`)
      .set(bearer(ownerToken))
      .send({ role: "ADMIN" });
    expect(changeOwner.status === 400 && errorEnvelope(changeOwner.body, "The team owner role cannot be changed")).toBe(
      true,
    );

    const adminChange = await api(app)
      .patch(`/api/v1/teams/${teamId}/members/${ownerId}`)
      .set(bearer(memberToken))
      .send({ role: "MEMBER" });
    expect(
      adminChange.status === 403 && errorEnvelope(adminChange.body, "Only the team owner can change member roles"),
    ).toBe(true);

    const renameByMember = await api(app).patch(`/api/v1/teams/${teamId}`).set(bearer(memberToken)).send({ name: "Stolen" });
    expect(
      renameByMember.status === 403 && errorEnvelope(renameByMember.body, "Only the team owner can rename the team"),
    ).toBe(true);

    const renamed = await api(app)
      .patch(`/api/v1/teams/${teamId}`)
      .set(bearer(ownerToken))
      .send({ name: "  Editors  ", createdBy: 1 });
    expect(
      renamed.status === 200 &&
        isRecord(dataOf(renamed.body)) &&
        dataOf(renamed.body)?.["name"] === "Editors" &&
        dataOf(renamed.body)?.["createdBy"] === ownerId,
    ).toBe(true);
  });

  it("team notes", async () => {
    const teamNote = await api(app).post(`/api/v1/teams/${teamId}/notes`).set(bearer(memberToken)).send({
      title: "Team secret",
      userId: 999999,
      teamId: 999999,
    });
    expect(teamNote.status === 201 && isNote(dataOf(teamNote.body))).toBe(true);
    expect(
      isRecord(dataOf(teamNote.body)) &&
        dataOf(teamNote.body)?.["createdBy"] === memberId &&
        dataOf(teamNote.body)?.["teamId"] === teamId &&
        dataOf(teamNote.body)?.["title"] === "Team secret",
    ).toBe(true);
    teamNoteId = isRecord(dataOf(teamNote.body)) ? Number(dataOf(teamNote.body).id) : 0;

    const outsiderTeamNote = await api(app)
      .post(`/api/v1/teams/${teamId}/notes`)
      .set(bearer(outsiderToken))
      .send({ title: "Nope" });
    expect(outsiderTeamNote.status === 404 && errorEnvelope(outsiderTeamNote.body, "Team not found")).toBe(true);

    const teamNotes = await api(app).get(`/api/v1/teams/${teamId}/notes`).set(bearer(ownerToken));
    expect(
      teamNotes.status === 200 &&
        Array.isArray(dataOf(teamNotes.body)) &&
        (dataOf(teamNotes.body) as Array<Record<string, unknown>>).map((note) => note.title).join(",") === "Team secret",
    ).toBe(true);

    const personalStill = await api(app).get("/api/v1/notes").set(bearer(ownerToken));
    expect(
      Array.isArray(dataOf(personalStill.body)) &&
        (dataOf(personalStill.body) as Array<Record<string, unknown>>).every((note) => note.teamId === null) &&
        (dataOf(personalStill.body) as Array<Record<string, unknown>>).some((note) => note.title === "Updated personal"),
    ).toBe(true);

    const patchTeamNote = await api(app)
      .patch(`/api/v1/teams/${teamId}/notes/${teamNoteId}`)
      .set(bearer(ownerToken))
      .send({ title: "Edited team", isPinned: true });
    expect(
      patchTeamNote.status === 200 &&
        isRecord(dataOf(patchTeamNote.body)) &&
        dataOf(patchTeamNote.body)?.["title"] === "Edited team",
    ).toBe(true);

    const patchPersonalViaTeam = await api(app)
      .patch(`/api/v1/teams/${teamId}/notes/${personalId}`)
      .set(bearer(ownerToken))
      .send({ title: "Stolen" });
    expect(patchPersonalViaTeam.status === 404 && errorEnvelope(patchPersonalViaTeam.body, "Note not found")).toBe(true);

    const deleteTeamNote = await api(app)
      .delete(`/api/v1/teams/${teamId}/notes/${teamNoteId}`)
      .set(bearer(memberToken));
    expect(deleteTeamNote.status).toBe(204);
    expect(deleteTeamNote.text).toBe("");

    const afterTeamDelete = await api(app).get(`/api/v1/teams/${teamId}/notes`).set(bearer(ownerToken));
    expect(Array.isArray(dataOf(afterTeamDelete.body)) && (dataOf(afterTeamDelete.body) as unknown[]).length === 0).toBe(
      true,
    );

    const recreateNote = await api(app).post(`/api/v1/teams/${teamId}/notes`).set(bearer(ownerToken)).send({ title: "Kept" });
    expect(recreateNote.status).toBe(201);
  });

  it("remove member, delete team, logout", async () => {
    const removeOwner = await api(app)
      .delete(`/api/v1/teams/${teamId}/members/${ownerId}`)
      .set(bearer(ownerToken));
    expect(removeOwner.status === 400 && errorEnvelope(removeOwner.body, "The team owner cannot be removed")).toBe(true);

    const memberRemove = await api(app)
      .delete(`/api/v1/teams/${teamId}/members/${ownerId}`)
      .set(bearer(memberToken));
    expect(memberRemove.status === 403 && errorEnvelope(memberRemove.body, "Only the team owner can remove members")).toBe(
      true,
    );

    const removed = await api(app).delete(`/api/v1/teams/${teamId}/members/${memberId}`).set(bearer(ownerToken));
    expect(removed.status).toBe(204);
    expect(removed.text).toBe("");

    const former = await api(app).get(`/api/v1/teams/${teamId}/members`).set(bearer(memberToken));
    expect(former.status === 404 && errorEnvelope(former.body, "Team not found")).toBe(true);

    const deleteByMember = await api(app).delete(`/api/v1/teams/${teamId}`).set(bearer(memberToken));
    expect(deleteByMember.status === 404 && errorEnvelope(deleteByMember.body, "Team not found")).toBe(true);

    const deletedTeam = await api(app).delete(`/api/v1/teams/${teamId}`).set(bearer(ownerToken));
    expect(deletedTeam.status).toBe(204);
    expect(deletedTeam.text).toBe("");

    const getDeleted = await api(app).get(`/api/v1/teams/${teamId}`).set(bearer(ownerToken));
    expect(getDeleted.status === 404 && errorEnvelope(getDeleted.body, "Team not found")).toBe(true);

    const personalAfterTeamGone = await api(app).get(`/api/v1/notes/${personalId}`).set(bearer(ownerToken));
    expect(
      personalAfterTeamGone.status === 200 &&
        isRecord(dataOf(personalAfterTeamGone.body)) &&
        dataOf(personalAfterTeamGone.body)?.["title"] === "Updated personal",
    ).toBe(true);

    const deletedNote = await api(app).delete(`/api/v1/notes/${personalId}`).set(bearer(ownerToken));
    expect(deletedNote.status).toBe(204);
    expect(deletedNote.text).toBe("");

    const getDeletedNote = await api(app).get(`/api/v1/notes/${personalId}`).set(bearer(ownerToken));
    expect(getDeletedNote.status === 404 && errorEnvelope(getDeletedNote.body, "Note not found")).toBe(true);

    const logout = await api(app).post("/api/v1/auth/logout").set(bearer(ownerToken));
    expect(logout.status).toBe(204);
    expect(logout.text).toBe("");

    const meAfterLogout = await api(app).get("/api/v1/auth/me").set(bearer(ownerToken));
    expect(meAfterLogout.status === 401 && errorEnvelope(meAfterLogout.body, "Authentication required")).toBe(true);

    const tasksGone = await api(app).get("/api/tasks");
    expect(tasksGone.status === 404 && errorEnvelope(tasksGone.body)).toBe(true);
  });
});
