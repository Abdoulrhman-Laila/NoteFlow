import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error.js";
import { teamService } from "../services/team.service.js";
import type { ApiSuccess } from "../types/api.js";
import type { Team, TeamMember } from "../types/team.js";
import type { PublicUser } from "../types/user.js";
import { parseAddTeamMember, parseCreateTeam, parseTeamId } from "../validation/team.validation.js";

function requireUserId(user: PublicUser | undefined): number {
  if (user === undefined) {
    throw new HttpError(401, "Authentication required");
  }

  return user.id;
}

export const createTeam: RequestHandler = async (req, res) => {
  const data = await teamService.create(requireUserId(req.authUser), parseCreateTeam(req.body));
  const body: ApiSuccess<Team> = { success: true, data };
  res.status(201).json(body);
};

export const listTeams: RequestHandler = async (req, res) => {
  const data = await teamService.listForUser(requireUserId(req.authUser));
  const body: ApiSuccess<Team[]> = { success: true, data };
  res.status(200).json(body);
};

export const addTeamMember: RequestHandler<{ id: string }> = async (req, res) => {
  const data = await teamService.addMember(
    requireUserId(req.authUser),
    parseTeamId(req.params.id),
    parseAddTeamMember(req.body),
  );
  const body: ApiSuccess<TeamMember> = { success: true, data };
  res.status(201).json(body);
};
