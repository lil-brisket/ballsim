import { redirect } from "next/navigation";
import { signInAction } from "@/application/actions/auth";
import { getCurrentUser } from "@/application/auth/session";
import { AuthForm } from "@/components/auth/AuthForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

/** Same-site paths only; anything else falls back to /home. */
function safeNext(raw: string | undefined): string {
  return raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
    ? raw
    : "/home";
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) {
    redirect(next);
  }
  return (
    <AuthForm mode="login" action={signInAction} next={next} error={error} />
  );
}
