export type SessionUser = {
  userId: string;
  username: string;
  universityDepartmentId: string;
  isVerified: boolean;
  role: string;
};

export type AuthSession = {
  user?: SessionUser;
};
