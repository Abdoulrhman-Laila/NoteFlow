import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import {
  api,
  bearer,
  deleteFixtures,
  disconnectDb,
  errorEnvelope,
  expect,
  hasErrorField,
  isRecord,
} from "./helpers.js";

process.env.NODE_ENV = "test";

const stamp = Date.now();
const password = "correct-horse";
const emails = [`neg-owner-${stamp}@example.com`, `neg-member-${stamp}@example.com`] as const;
const [ownerEmail, memberEmail] = emails;
const fakeToken = "A".repeat(43);

const app = createApp();

let ownerToken = "";
let memberToken = "";
let memberId = 0;
let teamId = 0;
let noteId = 0;

describe("Negative Testing", () => {
  before(async () => {
    await deleteFixtures([...emails]);

    const ownerReg = await api(app).post("/api/v1/auth/register").send({
      name: "Owner",
      email: ownerEmail,
      password,
    });
    const memberReg = await api(app).post("/api/v1/auth/register").send({
      name: "Member",
      email: memberEmail,
      password,
    });
    expect(ownerReg.status).toBe(201);
    expect(memberReg.status).toBe(201);

    ownerToken = isRecord(ownerReg.body.data) ? String(ownerReg.body.data.token) : "";
    memberToken = isRecord(memberReg.body.data) ? String(memberReg.body.data.token) : "";
    memberId = isRecord(memberReg.body.data) && isRecord(memberReg.body.data.user) ? Number(memberReg.body.data.user.id) : 0;

    const team = await api(app).post("/api/v1/teams").set(bearer(ownerToken)).send({ name: "Writers" });
    teamId = isRecord(team.body.data) ? Number(team.body.data.id) : 0;

    const note = await api(app).post("/api/v1/notes").set(bearer(ownerToken)).send({ title: "Keep" });
    noteId = isRecord(note.body.data) ? Number(note.body.data.id) : 0;

    await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: memberEmail, role: "MEMBER" });
  });

  after(async () => {
    await deleteFixtures([...emails]);
    await disconnectDb();
  });

  it("rejects empty or incomplete bodies with 400 errors", async () => {
    const missingRegister = await api(app).post("/api/v1/auth/register").send({});
    expect(
      missingRegister.status === 400 &&
        errorEnvelope(missingRegister.body, "Validation failed") &&
        hasErrorField(missingRegister.body, "name") &&
        hasErrorField(missingRegister.body, "email") &&
        hasErrorField(missingRegister.body, "password"),
    ).toBe(true);

    const missingLogin = await api(app).post("/api/v1/auth/login").send({ email: ownerEmail });
    expect(
      missingLogin.status === 400 &&
        errorEnvelope(missingLogin.body, "Validation failed") &&
        hasErrorField(missingLogin.body, "password"),
    ).toBe(true);

    const missingNoteTitle = await api(app).post("/api/v1/notes").set(bearer(ownerToken)).send({ content: "no title" });
    expect(
      missingNoteTitle.status === 400 &&
        errorEnvelope(missingNoteTitle.body, "Validation failed") &&
        hasErrorField(missingNoteTitle.body, "title"),
    ).toBe(true);

    const emptyPatch = await api(app).patch(`/api/v1/notes/${noteId}`).set(bearer(ownerToken)).send({});
    expect(emptyPatch.status === 400 && errorEnvelope(emptyPatch.body, "Validation failed")).toBe(true);

    const missingTeamName = await api(app).post("/api/v1/teams").set(bearer(ownerToken)).send({});
    expect(
      missingTeamName.status === 400 &&
        errorEnvelope(missingTeamName.body, "Validation failed") &&
        hasErrorField(missingTeamName.body, "name"),
    ).toBe(true);

    const missingMemberBody = await api(app).post(`/api/v1/teams/${teamId}/members`).set(bearer(ownerToken)).send({});
    expect(
      missingMemberBody.status === 400 &&
        errorEnvelope(missingMemberBody.body, "Validation failed") &&
        hasErrorField(missingMemberBody.body, "email") &&
        hasErrorField(missingMemberBody.body, "role"),
    ).toBe(true);

    const missingRole = await api(app)
      .patch(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set(bearer(ownerToken))
      .send({});
    expect(
      missingRole.status === 400 &&
        errorEnvelope(missingRole.body, "Validation failed") &&
        hasErrorField(missingRole.body, "role"),
    ).toBe(true);

    const missingJson = await api(app).post("/api/v1/auth/login");
    expect(missingJson.status === 400 && errorEnvelope(missingJson.body)).toBe(true);
  });

  it("returns 404 for missing resources", async () => {
    const missingNote = await api(app).get("/api/v1/notes/999999").set(bearer(ownerToken));
    expect(missingNote.status === 404 && errorEnvelope(missingNote.body, "Note not found")).toBe(true);

    const patchMissingNote = await api(app).patch("/api/v1/notes/999999").set(bearer(ownerToken)).send({ title: "X" });
    expect(patchMissingNote.status === 404 && errorEnvelope(patchMissingNote.body, "Note not found")).toBe(true);

    const deleteMissingNote = await api(app).delete("/api/v1/notes/999999").set(bearer(ownerToken));
    expect(deleteMissingNote.status === 404 && errorEnvelope(deleteMissingNote.body, "Note not found")).toBe(true);

    const missingTeam = await api(app).get("/api/v1/teams/999999").set(bearer(ownerToken));
    expect(missingTeam.status === 404 && errorEnvelope(missingTeam.body, "Team not found")).toBe(true);

    const missingTeamMembers = await api(app).get("/api/v1/teams/999999/members").set(bearer(ownerToken));
    expect(missingTeamMembers.status === 404 && errorEnvelope(missingTeamMembers.body, "Team not found")).toBe(true);

    const missingTeamNotes = await api(app).get("/api/v1/teams/999999/notes").set(bearer(ownerToken));
    expect(missingTeamNotes.status === 404 && errorEnvelope(missingTeamNotes.body, "Team not found")).toBe(true);

    const missingUserMember = await api(app)
      .patch(`/api/v1/teams/${teamId}/members/999999`)
      .set(bearer(ownerToken))
      .send({ role: "ADMIN" });
    expect(missingUserMember.status === 404 && errorEnvelope(missingUserMember.body, "User not found")).toBe(true);

    const removeMissingUser = await api(app).delete(`/api/v1/teams/${teamId}/members/999999`).set(bearer(ownerToken));
    expect(removeMissingUser.status === 404 && errorEnvelope(removeMissingUser.body, "User not found")).toBe(true);

    const missingTeamNote = await api(app)
      .patch(`/api/v1/teams/${teamId}/notes/999999`)
      .set(bearer(ownerToken))
      .send({ title: "X" });
    expect(missingTeamNote.status === 404 && errorEnvelope(missingTeamNote.body, "Note not found")).toBe(true);
  });

  it("rejects non-positive ids", async () => {
    const zeroId = await api(app).get("/api/v1/notes/0").set(bearer(ownerToken));
    expect(zeroId.status === 400 && errorEnvelope(zeroId.body, "Validation failed") && hasErrorField(zeroId.body, "id")).toBe(
      true,
    );

    const negativeId = await api(app).get("/api/v1/teams/-1").set(bearer(ownerToken));
    expect(negativeId.status === 400 && errorEnvelope(negativeId.body, "Validation failed")).toBe(true);

    const stringId = await api(app).delete("/api/v1/notes/abc").set(bearer(ownerToken));
    expect(stringId.status === 400 && errorEnvelope(stringId.body, "Validation failed")).toBe(true);
  });

  it("rejects missing or invalid credentials with 401", async () => {
    const noToken = await api(app).get("/api/v1/notes");
    expect(noToken.status === 401 && errorEnvelope(noToken.body, "Authentication required")).toBe(true);

    const bearerOnly = await api(app).get("/api/v1/notes").set({ Authorization: "Bearer" });
    expect(bearerOnly.status === 401 && errorEnvelope(bearerOnly.body, "Authentication required")).toBe(true);

    const basic = await api(app).get("/api/v1/notes").set({ Authorization: `Basic ${ownerToken}` });
    expect(basic.status === 401 && errorEnvelope(basic.body, "Authentication required")).toBe(true);

    const shortToken = await api(app).get("/api/v1/notes").set(bearer("short"));
    expect(shortToken.status === 401 && errorEnvelope(shortToken.body, "Authentication required")).toBe(true);

    const unknownToken = await api(app).get("/api/v1/notes").set(bearer(fakeToken));
    expect(unknownToken.status === 401 && errorEnvelope(unknownToken.body, "Authentication required")).toBe(true);

    const logoutUnknown = await api(app).post("/api/v1/auth/logout").set(bearer(fakeToken));
    expect(logoutUnknown.status === 401 && errorEnvelope(logoutUnknown.body, "Authentication required")).toBe(true);

    const memberNote = await api(app).get(`/api/v1/notes/${noteId}`).set(bearer(memberToken));
    expect(memberNote.status === 404 && errorEnvelope(memberNote.body, "Note not found")).toBe(true);
  });

  it("rejects duplicate email and membership", async () => {
    const duplicateEmail = await api(app).post("/api/v1/auth/register").send({
      name: "Owner",
      email: `  ${ownerEmail.toUpperCase()}  `,
      password,
    });
    expect(duplicateEmail.status === 409 && errorEnvelope(duplicateEmail.body, "Email is already registered")).toBe(true);

    const duplicateMember = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: memberEmail, role: "ADMIN" });
    expect(duplicateMember.status === 409 && errorEnvelope(duplicateMember.body, "User is already a team member")).toBe(
      true,
    );
  });

  it("ignores spoofed owner fields on notes", async () => {
    const spoofNote = await api(app).post("/api/v1/notes").set(bearer(ownerToken)).send({
      title: "Spoof",
      userId: 999999,
      teamId: 999999,
      createdBy: 1,
    });
    const spoofData = spoofNote.body.data as unknown;
    expect(
      spoofNote.status === 201 &&
        isRecord(spoofData) &&
        spoofData.teamId === null &&
        spoofData.createdBy !== 999999 &&
        spoofData.createdBy !== 1,
    ).toBe(true);
  });

  it("rejects wrong types, arrays, and malformed JSON", async () => {
    const wrongTypes = await api(app).post("/api/v1/notes").set(bearer(ownerToken)).send({
      title: 12,
      content: false,
      isPinned: "yes",
    });
    expect(
      wrongTypes.status === 400 &&
        errorEnvelope(wrongTypes.body, "Validation failed") &&
        hasErrorField(wrongTypes.body, "title"),
    ).toBe(true);

    const arrayBody = await api(app).post("/api/v1/auth/login").send([]);
    expect(arrayBody.status === 400 && errorEnvelope(arrayBody.body, "Request body must be a JSON object")).toBe(true);

    const invalidJson = await api(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(invalidJson.status === 400 && errorEnvelope(invalidJson.body, "Request body must be valid JSON")).toBe(true);

    const ownerRole = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: ownerEmail, role: "OWNER" });
    expect(
      ownerRole.status === 400 && errorEnvelope(ownerRole.body, "Validation failed") && hasErrorField(ownerRole.body, "role"),
    ).toBe(true);

    const stringPinned = await api(app)
      .patch(`/api/v1/notes/${noteId}`)
      .set(bearer(ownerToken))
      .send({ isPinned: "true" });
    expect(
      stringPinned.status === 400 &&
        errorEnvelope(stringPinned.body, "Validation failed") &&
        hasErrorField(stringPinned.body, "isPinned"),
    ).toBe(true);
  });
});
