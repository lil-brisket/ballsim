import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import {
  cn,
  focusRingClass,
  linkClass,
  panelClass,
} from "@/components/ui/styles";
import { SectionHeading } from "@/components/ui/SectionHeading";

const inputClass = cn(
  "min-h-11 w-full rounded-md border border-line-strong bg-surface-base px-3 py-2 text-sm text-ink",
  focusRingClass,
);

type AuthFormProps = {
  mode: "login" | "signup";
  action: (formData: FormData) => void | Promise<void>;
  next: string;
  error?: string;
};

/** Shared sign-in / sign-up form; posts to a server action. */
export function AuthForm({ mode, action, next, error }: AuthFormProps) {
  const signup = mode === "signup";
  const otherPath = signup ? "/login" : "/signup";
  const otherHref =
    next === "/home"
      ? otherPath
      : `${otherPath}?next=${encodeURIComponent(next)}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-2">
        <SectionHeading
          as="h1"
          size="lg"
          title={signup ? "Create an account" : "Sign in"}
        />
        {signup ? (
          <p className="text-sm text-muted">
            Accounts are only needed for online leagues.
          </p>
        ) : null}
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/50 bg-danger-soft p-3 text-sm text-danger-ink"
        >
          {error}
        </div>
      ) : null}

      <form action={action} className={cn(panelClass, "space-y-4 p-5")}>
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1">
          <label className="block text-sm text-soft" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={24}
            aria-describedby={signup ? "username-hint" : undefined}
            className={inputClass}
          />
          {signup ? (
            <p id="username-hint" className="text-sm text-muted">
              3 to 24 characters: letters, numbers, hyphens and underscores.
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label className="block text-sm text-soft" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 8 : undefined}
            maxLength={128}
            aria-describedby={signup ? "password-hint" : undefined}
            className={inputClass}
          />
          {signup ? (
            <p id="password-hint" className="text-sm text-muted">
              At least 8 characters.
            </p>
          ) : null}
        </div>
        <button type="submit" className={buttonClass({ variant: "primary" })}>
          {signup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="text-sm text-muted">
        {signup ? "Already have an account? " : "New here? "}
        <Link href={otherHref} className={cn(linkClass, "underline")}>
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </main>
  );
}
