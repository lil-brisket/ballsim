import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const USERNAME_PATTERN = /^[a-z0-9_-]+$/;

// OWASP-recommended scrypt baseline (N=2^15, r=8, p=1).
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1 } as const;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export type CredentialResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Trim and lowercase; usernames are case-insensitive. */
export function normalizeUsername(raw: unknown): CredentialResult<string> {
  if (typeof raw !== "string") {
    return { ok: false, error: "Enter a username." };
  }
  const username = raw.trim().toLowerCase();
  if (
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Usernames are ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`,
    };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: "Usernames may only use letters, numbers, - and _.",
    };
  }
  return { ok: true, value: username };
}

export function validateNewPassword(raw: unknown): CredentialResult<string> {
  if (typeof raw !== "string" || raw.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Passwords need at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (raw.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      error: `Passwords can be at most ${PASSWORD_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: raw };
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Encoded as `scrypt$N$r$p$saltB64$hashB64`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p } = SCRYPT_PARAMS;
  const key = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    "scrypt",
    N,
    r,
    p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) {
    return false;
  }
  const expected = Buffer.from(hashB64!, "base64");
  const actual = await scryptAsync(
    password,
    Buffer.from(saltB64!, "base64"),
    expected.length,
    { N, r, p, maxmem: SCRYPT_MAXMEM },
  );
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

/** 256-bit random token, URL-safe. Only its hash is ever stored. */
export function newSecretToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
