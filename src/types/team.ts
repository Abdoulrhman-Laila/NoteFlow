export const TEAM_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export interface Team {
  id: number;
  name: string;
  createdBy: number;
  role: TeamRole;
  createdAt: string;
}

export interface CreateTeamInput {
  name: string;
}

export type AssignableTeamRole = "ADMIN" | "MEMBER";

export interface AddTeamMemberInput {
  email: string;
  role: AssignableTeamRole;
}

export interface TeamMember {
  teamId: number;
  userId: number;
  name: string;
  email: string;
  role: AssignableTeamRole;
  joinedAt: string;
}

export interface StoredTeam {
  id: number;
  name: string;
  createdBy: number;
  createdAt: Date;
}
