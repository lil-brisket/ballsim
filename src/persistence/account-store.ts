/**
 * Persistence port for online-play accounts, sessions and league invites.
 * Secrets never reach this layer: sessions and invites are keyed by the
 * SHA-256 of their tokens, users by a scrypt password hash.
 */

export type UserRecord = {
  id: string;
  /** Lowercase login name. */
  username: string;
  passwordHash: string;
  createdAt: Date;
};

export type SessionRecord = {
  /** SHA-256 hex of the cookie token. */
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};

export type LeagueInviteRecord = {
  id: string;
  saveGameId: string;
  /** SHA-256 hex of the invite link token. */
  tokenHash: string;
  createdByUserId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  maxUses: number;
  uses: number;
  createdAt: Date;
};

export type AccountStore = {
  /** Throws {@link UsernameTakenError} when the username exists. */
  createUser(input: {
    id: string;
    username: string;
    passwordHash: string;
  }): Promise<UserRecord>;
  findUserByUsername(username: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;

  createSession(input: {
    id: string;
    userId: string;
    expiresAt: Date;
  }): Promise<SessionRecord>;
  findSession(id: string): Promise<SessionRecord | null>;
  deleteSession(id: string): Promise<void>;

  createInvite(input: {
    id: string;
    saveGameId: string;
    tokenHash: string;
    createdByUserId: string;
    expiresAt: Date;
    maxUses: number;
  }): Promise<LeagueInviteRecord>;
  findInviteByTokenHash(tokenHash: string): Promise<LeagueInviteRecord | null>;
  listInvites(saveGameId: string): Promise<LeagueInviteRecord[]>;
  /**
   * Atomically use one seat of an invite. Returns false when the invite is
   * missing, revoked, expired or used up (so two joiners cannot both take
   * the last use).
   */
  consumeInvite(id: string, now: Date): Promise<boolean>;
  /** Give back a use after a join that failed later. */
  releaseInvite(id: string): Promise<void>;
  revokeInvite(id: string, saveGameId: string, now: Date): Promise<boolean>;
};

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is taken.");
    this.name = "UsernameTakenError";
  }
}
