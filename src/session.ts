import type { User } from "./api";

export type Session = {
  token: string;
  user: User;
};
