import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../errors/http-error.js";
import { prisma } from "../lib/prisma.js";
import {
  TEAM_ROLES,
  type AddTeamMemberInput,
  type CreateTeamInput,
  type StoredTeam,
  type Team,
  type ListedTeamMember,
  type TeamMember,
  type TeamRole,
  type UpdateMemberRoleInput,
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

  async getForMember(userId: number, teamId: number): Promise<Team> {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: {
        role: true,
        team: { select: teamSelect },
      },
    });

    if (membership === null) {
      throw new HttpError(404, "Team not found");
    }

    if (!isTeamRole(membership.role)) {
      throw new HttpError(500, "Internal server error");
    }

    return toTeam(membership.team, membership.role);
  },

  async updateName(actorId: number, teamId: number, input: CreateTeamInput): Promise<Team> {
    const actor = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: actorId } },
      select: { role: true },
    });

    if (actor === null) {
      throw new HttpError(404, "Team not found");
    }

    if (actor.role !== "OWNER") {
      throw new HttpError(403, "Only the team owner can rename the team");
    }

    const updated = await prisma.team.updateManyAndReturn({
      where: { id: teamId },
      data: { name: input.name },
      select: teamSelect,
    });
    const team = updated[0];

    if (team === undefined) {
      throw new HttpError(404, "Team not found");
    }

    return toTeam(team, "OWNER");
  },

  async deleteForOwner(actorId: number, teamId: number): Promise<void> {
    const actor = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: actorId } },
      select: { role: true },
    });

    if (actor === null) {
      throw new HttpError(404, "Team not found");
    }

    if (actor.role !== "OWNER") {
      throw new HttpError(403, "Only the team owner can delete the team");
    }

    const deleted = await prisma.team.deleteMany({
      where: { id: teamId },
    });

    if (deleted.count === 0) {
      throw new HttpError(404, "Team not found");
    }
  },

  async listMembers(actorId: number, teamId: number): Promise<ListedTeamMember[]> {
    const actor = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: actorId } },
      select: { teamId: true },
    });

    if (actor === null) {
      throw new HttpError(404, "Team not found");
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      select: {
        teamId: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    return members.flatMap((member) => {
      if (!isTeamRole(member.role)) return [];
      return [
        {
          teamId: member.teamId,
          userId: member.userId,
          name: member.user.name,
          email: member.user.email,
          role: member.role,
          joinedAt: member.joinedAt.toISOString(),
        },
      ];
    });
  },

  async removeMember(actorId: number, teamId: number, memberUserId: number): Promise<void> {
    const actor = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: actorId } },
      select: { role: true },
    });

    if (actor === null) {
      throw new HttpError(404, "Team not found");
    }

    if (actor.role !== "OWNER") {
      throw new HttpError(403, "Only the team owner can remove members");
    }

    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberUserId } },
      select: { role: true },
    });

    if (target === null) {
      throw new HttpError(404, "User not found");
    }

    if (target.role === "OWNER") {
      throw new HttpError(400, "The team owner cannot be removed");
    }

    const deleted = await prisma.teamMember.deleteMany({
      where: {
        teamId,
        userId: memberUserId,
        role: { not: "OWNER" },
      },
    });

    if (deleted.count === 0) {
      throw new HttpError(404, "User not found");
    }
  },

  async updateMemberRole(
    actorId: number,
    teamId: number,
    memberUserId: number,
    input: UpdateMemberRoleInput,
  ): Promise<TeamMember> {
    const actor = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: actorId } },
      select: { role: true },
    });

    if (actor === null) {
      throw new HttpError(404, "Team not found");
    }

    if (actor.role !== "OWNER") {
      throw new HttpError(403, "Only the team owner can change member roles");
    }

    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberUserId } },
      select: {
        role: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (target === null) {
      throw new HttpError(404, "User not found");
    }

    if (target.role === "OWNER") {
      throw new HttpError(400, "The team owner role cannot be changed");
    }

    const updated = await prisma.teamMember.updateManyAndReturn({
      where: {
        teamId,
        userId: memberUserId,
        role: { not: "OWNER" },
      },
      data: { role: input.role },
      select: {
        teamId: true,
        userId: true,
        role: true,
        joinedAt: true,
      },
    });
    const member = updated[0];

    if (member === undefined) {
      throw new HttpError(404, "User not found");
    }

    if (member.role !== "ADMIN" && member.role !== "MEMBER") {
      throw new HttpError(500, "Internal server error");
    }

    return {
      teamId: member.teamId,
      userId: member.userId,
      name: target.user.name,
      email: target.user.email,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    };
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
