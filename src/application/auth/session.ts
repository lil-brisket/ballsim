import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { prismaAccountStore } from "@/persistence/account-repository";
import {
  type AccountUser,
  resolveSessionUser,
} from "@/application/auth/accounts";

export const SESSION_COOKIE = "ballsim_session";

/**
 * The signed-in user for this request (deduplicated per render via React
 * cache). Null outside a request scope or when signed out.
 */
export const getCurrentUser = cache(async (): Promise<AccountUser | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    // Not in a request (scripts, build): nobody is signed in.
    return null;
  }
  return resolveSessionUser(prismaAccountStore, token);
});

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

/** Server Functions / Route Handlers only. */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Server Functions / Route Handlers only. Returns the old token, if any. */
export async function clearSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  return token;
}
