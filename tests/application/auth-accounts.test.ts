import { afterEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  hashToken,
  normalizeUsername,
  verifyPassword,
} from "@/application/auth/credentials";
import {
  resetSignInRateLimit,
  resolveSessionUser,
  signIn,
  signOut,
  signUp,
} from "@/application/auth/accounts";
import { createMemoryAccountStore } from "@/persistence/memory-account-store";

afterEach(() => {
  resetSignInRateLimit();
});

describe("credentials", () => {
  it("normalizes usernames and rejects bad ones", () => {
    expect(normalizeUsername("  Alex_99 ")).toEqual({
      ok: true,
      value: "alex_99",
    });
    expect(normalizeUsername("ab").ok).toBe(false);
    expect(normalizeUsername("has space").ok).toBe(false);
    expect(normalizeUsername("x".repeat(25)).ok).toBe(false);
  });

  it("hashes passwords with a per-hash salt and verifies them", async () => {
    const a = await hashPassword("correct horse");
    const b = await hashPassword("correct horse");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toContain("correct horse");
    expect(await verifyPassword("correct horse", a)).toBe(true);
    expect(await verifyPassword("wrong horse", a)).toBe(false);
    expect(await verifyPassword("correct horse", "garbage")).toBe(false);
  });
});

describe("accounts", () => {
  it("signs up, stores only hashes, and resolves the session", async () => {
    const store = createMemoryAccountStore();
    const result = await signUp(store, {
      username: "Alex",
      password: "password123",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.username).toBe("alex");

    const stored = await store.findUserByUsername("alex");
    expect(stored!.passwordHash).not.toContain("password123");
    expect(await store.findSession(result.token)).toBeNull();
    expect(await store.findSession(hashToken(result.token))).not.toBeNull();

    expect(await resolveSessionUser(store, result.token)).toEqual(result.user);
  });

  it("rejects duplicate usernames case-insensitively and weak passwords", async () => {
    const store = createMemoryAccountStore();
    await signUp(store, { username: "alex", password: "password123" });
    const dup = await signUp(store, {
      username: "ALEX",
      password: "password123",
    });
    expect(dup.ok).toBe(false);
    const weak = await signUp(store, { username: "sam", password: "short" });
    expect(weak.ok).toBe(false);
  });

  it("signs in with the right password only, with one generic error", async () => {
    const store = createMemoryAccountStore();
    await signUp(store, { username: "alex", password: "password123" });
    const good = await signIn(store, {
      username: "Alex",
      password: "password123",
    });
    expect(good.ok).toBe(true);
    const wrong = await signIn(store, {
      username: "alex",
      password: "nope-nope",
    });
    const missing = await signIn(store, { username: "nobody", password: "x" });
    expect(wrong.ok || missing.ok).toBe(false);
    if (!wrong.ok && !missing.ok) {
      expect(wrong.error).toBe(missing.error);
    }
  });

  it("locks a username out after repeated failures", async () => {
    const store = createMemoryAccountStore();
    await signUp(store, { username: "alex", password: "password123" });
    for (let i = 0; i < 10; i += 1) {
      await signIn(store, { username: "alex", password: "wrong-password" });
    }
    const locked = await signIn(store, {
      username: "alex",
      password: "password123",
    });
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.error).toMatch(/Too many failed attempts/);
    }
  });

  it("expires and signs out sessions", async () => {
    const store = createMemoryAccountStore();
    const created = await signUp(store, {
      username: "alex",
      password: "password123",
    });
    if (!created.ok) throw new Error(created.error);
    const later = new Date(created.expiresAt.getTime() + 1);
    expect(await resolveSessionUser(store, created.token, later)).toBeNull();

    const again = await signIn(store, {
      username: "alex",
      password: "password123",
    });
    if (!again.ok) throw new Error(again.error);
    await signOut(store, again.token);
    expect(await resolveSessionUser(store, again.token)).toBeNull();
    expect(await resolveSessionUser(store, undefined)).toBeNull();
  });
});
