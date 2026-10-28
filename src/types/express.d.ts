import type { PublicUser } from "./user.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: PublicUser;
    }
  }
}
