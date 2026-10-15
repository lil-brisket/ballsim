"use server";

import { redirect } from "next/navigation";
import { prismaAccountStore } from "@/persistence/account-repository";
import { signIn, signOut, signUp } from "@/application/auth/accounts";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/application/auth/session";
import { redirectWithError } from "@/application/actions/shared";

/** Only same-site paths; never an absolute or protocol-relative URL. */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/home";
}

function withNext(path: string, next: string): string {
  return next === "/home" ? path : `${path}?next=${encodeURIComponent(next)}`;
}

export async function signUpAction(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const result = await signUp(prismaAccountStore, {
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!result.ok) {
    redirectWithError(withNext("/signup", next), result.error);
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect(next);
}

export async function signInAction(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const result = await signIn(prismaAccountStore, {
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!result.ok) {
    redirectWithError(withNext("/login", next), result.error);
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const token = await clearSessionCookie();
  await signOut(prismaAccountStore, token);
  redirect("/");
}
