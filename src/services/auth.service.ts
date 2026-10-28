import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../errors/http-error.js";
import { prisma } from "../lib/prisma.js";
import {
  toPublicUser,
  type AuthSession,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  type UserProfile,
} from "../types/user.js";
import { normalizeEmail } from "../utils/email.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { createSessionToken, hashSessionToken } from "../utils/token.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let dummyPasswordHash: Promise<string> | undefined;

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function cachedDummyPasswordHash(): Promise<string> {
  if (dummyPasswordHash === undefined) {
    dummyPasswordHash = hashPassword("invalid-password-placeholder").catch((error: unknown) => {
      dummyPasswordHash = undefined;
      throw error;
    });
  }

  return dummyPasswordHash;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function constraintName(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const target = error.meta?.["target"];
  if (typeof target === "string" && target.length > 0) return target;

  if (Array.isArray(target)) {
    const names = target.filter((field): field is string => typeof field === "string");
    if (names.length > 0) return names.join(" ");
  }

  const adapterError = error.meta?.["driverAdapterError"];
  if (!isRecord(adapterError) || !isRecord(adapterError["cause"])) return undefined;

  const constraint = adapterError["cause"]["constraint"];
  if (!isRecord(constraint) || typeof constraint["index"] !== "string") return undefined;

  return constraint["index"];
}

function isEmailConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const constraint = constraintName(error);
  return constraint !== undefined && constraint.includes("email");
}

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
} as const;

function logDatabaseError(action: "register" | "login" | "authenticate" | "logout", error: unknown): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`Database error during ${action}: ${error.code}`);
    return;
  }

  console.error(`Database error during ${action}`);
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const { token, tokenHash } = createSessionToken();

    try {
      const user = await prisma.$transaction(async (tx) => {
        const created: UserProfile = await tx.user.create({
          data: {
            name: input.name,
            email,
            passwordHash,
          },
          select: publicUserSelect,
        });

        await tx.session.create({
          data: {
            userId: created.id,
            tokenHash,
            expiresAt: sessionExpiry(),
          },
        });

        return created;
      });

      return {
        user: toPublicUser(user),
        token,
      };
    } catch (error) {
      if (isEmailConflict(error)) {
        throw new HttpError(409, "Email is already registered");
      }

      logDatabaseError("register", error);
      throw new HttpError(500, "Internal server error");
    }
  },

  async login(input: LoginInput): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...publicUserSelect,
        passwordHash: true,
      },
    });

    const passwordHash = user === null ? await cachedDummyPasswordHash() : user.passwordHash;
    const passwordMatches = await verifyPassword(input.password, passwordHash);
    if (user === null || !passwordMatches) {
      throw new HttpError(401, "Invalid email or password");
    }

    const { token, tokenHash } = createSessionToken();

    try {
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: sessionExpiry(),
        },
      });
    } catch (error) {
      logDatabaseError("login", error);
      throw new HttpError(500, "Internal server error");
    }

    return {
      user: toPublicUser(user),
      token,
    };
  },

  async authenticate(token: string): Promise<PublicUser> {
    const tokenHash = hashSessionToken(token);

    try {
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        select: {
          expiresAt: true,
          user: { select: publicUserSelect },
        },
      });

      if (session === null) {
        throw new HttpError(401, "Authentication required");
      }

      if (session.expiresAt <= new Date()) {
        await prisma.session.deleteMany({ where: { tokenHash } });
        throw new HttpError(401, "Authentication required");
      }

      return toPublicUser(session.user);
    } catch (error) {
      if (error instanceof HttpError) throw error;

      logDatabaseError("authenticate", error);
      throw new HttpError(500, "Internal server error");
    }
  },

  async logout(token: string): Promise<void> {
    const tokenHash = hashSessionToken(token);

    try {
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        select: { expiresAt: true },
      });

      if (session === null || session.expiresAt <= new Date()) {
        if (session !== null) {
          await prisma.session.deleteMany({ where: { tokenHash } });
        }
        throw new HttpError(401, "Authentication required");
      }

      await prisma.session.deleteMany({ where: { tokenHash } });
    } catch (error) {
      if (error instanceof HttpError) throw error;

      logDatabaseError("logout", error);
      throw new HttpError(500, "Internal server error");
    }
  },
};
