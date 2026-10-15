/**
 * Account and session commands for online play. Store-injected so tests run
 * against the memory adapter; cookie handling lives in ./session.
 */

import {
  type AccountStore,
  UsernameTakenError,
} from "@/persistence/account-store";
import {
  hashPassword,
  hashToken,
  newSecretToken,
  normalizeUsername,
  validateNewPassword,
  verifyPassword,
} from "@/application/auth/credentials";

export const SESSION_TTL_DAYS = 30;

const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
const SIGN_IN_MAX_FAILURES = 10;

/** Account as exposed to the app — never includes the password hash. */
export type AccountUser = { id: string; username: string };

export type AuthResult =
  | { ok: true; user: AccountUser; token: string; expiresAt: Date }
  | { ok: false; error: string };

// Per-username failed sign-in counter (single server process).
const failures = new Map<string, { count: number; since: number }>();

function isLockedOut(username: string, now: number): boolean {
  const entry = failures.get(username);
  if (!entry || now - entry.since > SIGN_IN_WINDOW_MS) {
    failures.delete(username);
    return false;
  }
  return entry.count >= SIGN_IN_MAX_FAILURES;
}

function recordFailure(username: string, now: number): void {
  const entry = failures.get(username);
  if (!entry || now - entry.since > SIGN_IN_WINDOW_MS) {
    failures.set(username, { count: 1, since: now });
  } else {
    entry.count += 1;
  }
}

/** Test hook: forget rate-limit state. */
export function resetSignInRateLimit(): void {
  failures.clear();
}

async function startSession(
  store: AccountStore,
  user: AccountUser,
  now: Date,
): Promise<AuthResult> {
  const token = newSecretToken();
  const expiresAt = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await store.createSession({ id: hashToken(token), userId: user.id, expiresAt });
  return { ok: true, user, token, expiresAt };
}

export async function signUp(
  store: AccountStore,
  input: { username: unknown; password: unknown },
  now = new Date(),
): Promise<AuthResult> {
  const username = normalizeUsername(input.username);
  if (!username.ok) {
    return username;
  }
  const password = validateNewPassword(input.password);
  if (!password.ok) {
    return password;
  }
  try {
    const user = await store.createUser({
      id: crypto.randomUUID(),
      username: username.value,
      passwordHash: await hashPassword(password.value),
    });
    return startSession(store, { id: user.id, username: user.username }, now);
  } catch (error) {
    if (error instanceof UsernameTakenError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

const SIGN_IN_FAILED = "Wrong username or password.";
let dummyHash: Promise<string> | undefined;

export async function signIn(
  store: AccountStore,
  input: { username: unknown; password: unknown },
  now = new Date(),
): Promise<AuthResult> {
  const username = normalizeUsername(input.username);
  if (!username.ok || typeof input.password !== "string") {
    return { ok: false, error: SIGN_IN_FAILED };
  }
  if (isLockedOut(username.value, now.getTime())) {
    return {
      ok: false,
      error: "Too many failed attempts. Try again in 15 minutes.",
    };
  }
  const user = await store.findUserByUsername(username.value);
  // Hash even for unknown usernames so timing does not reveal which exist.
  dummyHash ??= hashPassword("not-a-real-password");
  const valid = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await dummyHash),
  );
  if (!user || !valid) {
    recordFailure(username.value, now.getTime());
    return { ok: false, error: SIGN_IN_FAILED };
  }
  failures.delete(username.value);
  return startSession(store, { id: user.id, username: user.username }, now);
}

/** The signed-in user for a cookie token, or null if missing/expired. */
export async function resolveSessionUser(
  store: AccountStore,
  token: string | undefined,
  now = new Date(),
): Promise<AccountUser | null> {
  if (!token) {
    return null;
  }
  const id = hashToken(token);
  const session = await store.findSession(id);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= now) {
    await store.deleteSession(id);
    return null;
  }
  const user = await store.findUserById(session.userId);
  return user ? { id: user.id, username: user.username } : null;
}

export async function signOut(
  store: AccountStore,
  token: string | undefined,
): Promise<void> {
  if (token) {
    await store.deleteSession(hashToken(token));
  }
}
