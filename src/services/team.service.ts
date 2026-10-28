import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../errors/http-error.js";
import { prisma } from "../lib/prisma.js";
import {
  TEAM_ROLES,
  type AddTeamMemberInput,
  type CreateTeamInput,
  type StoredTeam,
  type Team,
  type TeamMember,
  type TeamRole,
} from "../types/team.js";

const teamSelect = {
  id: true,
  name: true,
  createdBy: true,
  createdAt: true,
} as const;

function isTeamRole(value: string): value is TeamRole {
  return TEAM_ROLES.some((role) => role === value);
}

function toTeam(team: StoredTeam, role: TeamRole): Team {
  return {
    id: team.id,
    name: team.name,
    createdBy: team.createdBy,
    role,
    createdAt: team.createdAt.toISOString(),
  };
}

export const teamService = {
  async create(userId: number, input: CreateTeamInput): Promise<Team> {
    try {
      const created: StoredTeam = await prisma.$transaction(async (tx) => {
        const team = await tx.team.create({
          data: {
            name: input.name,
            createdBy: userId,
          },
          select: teamSelect,
        });

        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId,
            role: "OWNER",
          },
        });

        return team;
      });

      return toTeam(created, "OWNER");
    } catch (error) {
      console.error("Database error during team create");
      throw error instanceof HttpError ? error : new HttpError(500, "Internal server error");
    }
  },

  async listForUser(userId: number): Promise<Team[]> {
    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      select: {
        role: true,
        team: { select: teamSelect },
      },
      orderBy: { team: { createdAt: "desc" } },
    });

    return memberships.flatMap((membership) => {
      if (!isTeamRole(membership.role)) return [];
      return [toTeam(membership.team, membership.role)];
    });
  },

  async addMember(actorId: number, teamId: number, input: AddTeamMemberInput): Promise<TeamMember> {
    const actor = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: actorId } },
      select: { role: true },
    });

    if (actor === null) {
      throw new HttpError(404, "Team not found");
    }

    if (actor.role !== "OWNER") {
      throw new HttpError(403, "Only the team owner can add members");
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, name: true, email: true },
    });

    if (user === null) {
      throw new HttpError(404, "User not found");
    }

    try {
      const member = await prisma.teamMember.create({
        data: {
          teamId,
          userId: user.id,
          role: input.role,
        },
        select: {
          teamId: true,
          userId: true,
          role: true,
          joinedAt: true,
        },
      });

      if (member.role !== "ADMIN" && member.role !== "MEMBER") {
        throw new HttpError(500, "Internal server error");
      }

      return {
        teamId: member.teamId,
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "User is already a team member");
      }

      console.error("Database error during team member create");
      throw new HttpError(500, "Internal server error");
    }
  },
};
