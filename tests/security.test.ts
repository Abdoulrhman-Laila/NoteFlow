import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { verifyPassword } from "../src/utils/password.js";
import { api, bearer, deleteFixtures, disconnectDb, expect, isRecord } from "./helpers.js";

process.env.NODE_ENV = "test";

const stamp = Date.now();
const password = "correct-horse";
const emails = [
  `sec-owner-${stamp}@example.com`,
  `sec-member-${stamp}@example.com`,
  `sec-outsider-${stamp}@example.com`,
] as const;
const [ownerEmail, memberEmail, outsiderEmail] = emails;

const app = createApp();
const loginHits: number[] = [];

let ownerToken = "";
let memberToken = "";
let outsiderToken = "";
let teamId = 0;
let personalId = 0;

describe("Security Audit", () => {
  before(async () => {
    await deleteFixtures([...emails]);
    process.env.TEST_RATE_LIMIT = "1";

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
    const outsiderReg = await api(app).post("/api/v1/auth/register").send({
      name: "Outsider",
      email: outsiderEmail,
      password,
    });

    ownerToken = isRecord(ownerReg.body.data) ? String(ownerReg.body.data.token) : "";
    memberToken = isRecord(memberReg.body.data) ? String(memberReg.body.data.token) : "";
    outsiderToken = isRecord(outsiderReg.body.data) ? String(outsiderReg.body.data.token) : "";
  });

  after(async () => {
    delete process.env.TEST_RATE_LIMIT;
    await deleteFixtures([...emails]);
    await disconnectDb();
  });

  it("Authentication: opaque session, no JWT, shared 401", async () => {
    expect(ownerToken.length === 43 && ownerToken.split(".").length !== 3).toBe(true);

    const jwtLike = await api(app)
      .get("/api/v1/notes")
      .set(bearer("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.e"));
    expect(jwtLike.status === 401 && isRecord(jwtLike.body) && jwtLike.body.message === "Authentication required").toBe(
      true,
    );

    const loginUnknown = await api(app).post("/api/v1/auth/login").send({
      email: `missing-${stamp}@example.com`,
      password,
    });
    const loginWrong = await api(app).post("/api/v1/auth/login").send({
      email: ownerEmail,
      password: "wrong-password-here",
    });
    loginHits.push(loginUnknown.status, loginWrong.status);
    expect(
      loginUnknown.status === 401 &&
        loginWrong.status === 401 &&
        isRecord(loginUnknown.body) &&
        isRecord(loginWrong.body) &&
        loginUnknown.body.message === "Invalid email or password" &&
        loginWrong.body.message === loginUnknown.body.message,
    ).toBe(true);
  });

  it("Password Hashing: scrypt N=32768", async () => {
    const dbUser = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { passwordHash: true },
    });
    expect(dbUser !== null && dbUser.passwordHash.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(dbUser !== null && dbUser.passwordHash !== password && (await verifyPassword(password, dbUser.passwordHash))).toBe(
      true,
    );
  });

  it("Sensitive Data Exposure: responses omit hashes; duplicate email is 409", async () => {
    const ownerReg = await api(app).post("/api/v1/auth/register").send({
      name: "Owner",
      email: ownerEmail,
      password,
    });
    const ownerBody = JSON.stringify(ownerReg.body);
    expect(ownerReg.status).toBe(409);
    expect(!ownerBody.toLowerCase().includes("password") && !ownerBody.includes("tokenHash")).toBe(true);
    expect(isRecord(ownerReg.body) && ownerReg.body.message === "Email is already registered").toBe(true);
  });

  it("Authorization: note isolation and outsider 404", async () => {
    const team = await api(app).post("/api/v1/teams").set(bearer(ownerToken)).send({ name: "Writers" });
    teamId = isRecord(team.body.data) ? Number(team.body.data.id) : 0;
    await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: memberEmail, role: "MEMBER" });

    const personal = await api(app).post("/api/v1/notes").set(bearer(ownerToken)).send({ title: "Secret" });
    personalId = isRecord(personal.body.data) ? Number(personal.body.data.id) : 0;

    const memberReadsPersonal = await api(app).get(`/api/v1/notes/${personalId}`).set(bearer(memberToken));
    expect(
      memberReadsPersonal.status === 404 &&
        isRecord(memberReadsPersonal.body) &&
        memberReadsPersonal.body.message === "Note not found",
    ).toBe(true);

    const outsiderTeam = await api(app).get(`/api/v1/teams/${teamId}`).set(bearer(outsiderToken));
    const outsiderMembers = await api(app).get(`/api/v1/teams/${teamId}/members`).set(bearer(outsiderToken));
    const outsiderAdd = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(outsiderToken))
      .send({ email: outsiderEmail, role: "MEMBER" });
    expect(
      outsiderTeam.status === 404 &&
        outsiderMembers.status === 404 &&
        outsiderAdd.status === 404 &&
        isRecord(outsiderTeam.body) &&
        outsiderTeam.body.message === "Team not found",
    ).toBe(true);

    const memberRename = await api(app)
      .patch(`/api/v1/teams/${teamId}`)
      .set(bearer(memberToken))
      .send({ name: "Hijack" });
    expect(
      memberRename.status === 403 &&
        isRecord(memberRename.body) &&
        memberRename.body.message === "Only the team owner can rename the team",
    ).toBe(true);

    const missingUser = await api(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set(bearer(ownerToken))
      .send({ email: `ghost-${stamp}@example.com`, role: "MEMBER" });
    expect(missingUser.status === 404 && isRecord(missingUser.body) && missingUser.body.message === "User not found").toBe(
      true,
    );
  });

  it("Input Validation and SQL Injection: payloads are not executed", async () => {
    const sqliEmail = await api(app).post("/api/v1/auth/login").send({
      email: "' OR 1=1 --@x.com",
      password,
    });
    loginHits.push(sqliEmail.status);
    expect(sqliEmail.status === 400 || sqliEmail.status === 401).toBe(true);

    const sqliTitle = await api(app)
      .post("/api/v1/notes")
      .set(bearer(ownerToken))
      .send({ title: "'; DROP TABLE notes; --" });
    const notesStillThere = await prisma.note.count({ where: { id: personalId } });
    expect(sqliTitle.status).toBe(201);
    expect(notesStillThere).toBe(1);

    const injectionId = await api(app).get("/api/v1/notes/1%20OR%201=1").set(bearer(ownerToken));
    expect(injectionId.status === 400 && isRecord(injectionId.body) && injectionId.body.message === "Validation failed").toBe(
      true,
    );
  });

  it("Rate Limiting: 5 login attempts then 429; register store is separate; /me unlimited", async () => {
    while (loginHits.length < 6) {
      const attempt = await api(app).post("/api/v1/auth/login").send({ email: "x" });
      loginHits.push(attempt.status);
    }
    expect(loginHits.slice(0, 5).every((status) => status !== 429) && loginHits[5] === 429).toBe(true);

    const registerDuringLoginLimit = await api(app).post("/api/v1/auth/register").send({ name: "X" });
    expect(registerDuringLoginLimit.status).toBe(400);

    const meUnlimited: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      meUnlimited.push((await api(app).get("/api/v1/auth/me")).status);
    }
    expect(meUnlimited.every((status) => status === 401)).toBe(true);
  });

  it("CORS Configuration and Security Headers", async () => {
    const cors = await api(app)
      .options("/api/v1/auth/login")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "POST");
    const allowOrigin = cors.headers["access-control-allow-origin"];
    expect(allowOrigin === undefined || allowOrigin === "false").toBe(true);

    const headers = await api(app).get("/api/health");
    expect(headers.headers["x-powered-by"]).toBe(undefined);
    expect(headers.headers["x-content-type-options"]).toBe("nosniff");
    expect(String(headers.headers["content-security-policy"] ?? "").includes("default-src 'none'")).toBe(true);
    expect(headers.headers["strict-transport-security"]).toBe(undefined);
  });

  it("Error Information Leakage: generic 500 and log without secrets", async () => {
    const logs: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(" "));
    };

    const fakeRes = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
    };

    errorHandler(
      Object.assign(new Error("postgresql://notes_app:super-secret@localhost/db"), { code: "P2002" }),
      {} as never,
      fakeRes as never,
      (() => undefined) as never,
    );
    console.error = original;

    const joined = logs.join("\n");
    expect(fakeRes.statusCode).toBe(500);
    expect(
      JSON.stringify(fakeRes.body).includes("Internal server error") && !JSON.stringify(fakeRes.body).includes("super-secret"),
    ).toBe(true);
    expect(!joined.includes("super-secret") && !joined.includes("postgresql://")).toBe(true);
  });
});
