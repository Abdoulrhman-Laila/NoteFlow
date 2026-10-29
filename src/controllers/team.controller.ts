import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error.js";
import { teamService } from "../services/team.service.js";
import type { ApiSuccess } from "../types/api.js";
import type { ListedTeamMember, Team, TeamMember } from "../types/team.js";
import type { PublicUser } from "../types/user.js";
import { parseAddTeamMember, parseCreateTeam, parseTeamId, parseUpdateMemberRole, parseUserId } from "../validation/team.validation.js";

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

export const getTeam: RequestHandler<{ id: string }> = async (req, res) => {
  const data = await teamService.getForMember(requireUserId(req.authUser), parseTeamId(req.params.id));
  const body: ApiSuccess<Team> = { success: true, data };
  res.status(200).json(body);
};

export const updateTeam: RequestHandler<{ id: string }> = async (req, res) => {
  const data = await teamService.updateName(
    requireUserId(req.authUser),
    parseTeamId(req.params.id),
    parseCreateTeam(req.body),
  );
  const body: ApiSuccess<Team> = { success: true, data };
  res.status(200).json(body);
};

export const deleteTeam: RequestHandler<{ id: string }> = async (req, res) => {
  await teamService.deleteForOwner(requireUserId(req.authUser), parseTeamId(req.params.id));
  res.status(204).send();
};

export const listTeamMembers: RequestHandler<{ id: string }> = async (req, res) => {
  const data = await teamService.listMembers(requireUserId(req.authUser), parseTeamId(req.params.id));
  const body: ApiSuccess<ListedTeamMember[]> = { success: true, data };
  res.status(200).json(body);
};

export const removeTeamMember: RequestHandler<{ id: string; userId: string }> = async (req, res) => {
  await teamService.removeMember(
    requireUserId(req.authUser),
    parseTeamId(req.params.id),
    parseUserId(req.params.userId),
  );
  res.status(204).send();
};

export const updateTeamMember: RequestHandler<{ id: string; userId: string }> = async (req, res) => {
  const data = await teamService.updateMemberRole(
    requireUserId(req.authUser),
    parseTeamId(req.params.id),
    parseUserId(req.params.userId),
    parseUpdateMemberRole(req.body),
  );
  const body: ApiSuccess<TeamMember> = { success: true, data };
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
