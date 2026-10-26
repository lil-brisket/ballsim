import Link from "next/link";
import { signOutAction } from "@/application/actions/auth";
import { getCurrentUser } from "@/application/auth/session";
import { listGameModeDefinitions } from "@/application/game-mode-catalog";
import { GameBrand } from "@/components/game/GameBrand";
import { GameModeCard } from "@/components/game/GameModeCard";
import { SplashBackground } from "@/components/game/SplashBackground";
import { ErrorState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";

type HomePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { error } = await searchParams;
  const modes = listGameModeDefinitions();
  const user = await getCurrentUser();

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <SplashBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12 sm:py-16">
        <header className="space-y-6">
          <GameBrand className="justify-center sm:justify-start" />
          <SectionHeading
            as="h2"
            size="lg"
            eyebrow="Build your basketball story"
            title="Choose your mode"
          />
        </header>

        {error ? <ErrorState message={error} /> : null}

        <section className="space-y-4" aria-label="Game modes">
          {modes
            .filter((mode) => mode.available)
            .map((mode) => (
              <GameModeCard key={mode.id} mode={mode} />
            ))}
          <div className="grid gap-3 sm:grid-cols-2">
            {modes
              .filter((mode) => !mode.available)
              .map((mode) => (
                <GameModeCard key={mode.id} mode={mode} />
              ))}
          </div>
        </section>

        <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-6 border-t border-surface-line pt-4 sm:justify-between">
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center text-sm text-muted hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
          >
            Settings
          </Link>
          {user ? (
            <form
              action={signOutAction}
              className="flex items-center gap-2 text-sm text-muted"
            >
              <span>Signed in as {user.username} ·</span>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center text-soft underline hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-sm text-muted hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
            >
              Sign in for online leagues
            </Link>
          )}
        </footer>
      </div>
    </main>
  );
}
