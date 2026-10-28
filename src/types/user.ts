export interface UserProfile {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthSession {
  user: PublicUser;
  token: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function toPublicUser(user: UserProfile): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
