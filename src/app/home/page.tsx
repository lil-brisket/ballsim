import Link from "next/link";
import { signOutAction } from "@/application/actions/auth";
import { getCurrentUser } from "@/application/auth/session";
import { listGameModeDefinitions } from "@/application/game-mode-catalog";
import { GameBrand } from "@/components/game/GameBrand";
import { GameModeCard } from "@/components/game/GameModeCard";
import { SplashBackground } from "@/components/game/SplashBackground";
import { ErrorState } from "@/components/owner/EmptyState";
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
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12 sm:py-16">
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

        <section
          className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
          aria-label="Game modes"
        >
          {modes.map((mode) => (
            <GameModeCard key={mode.id} mode={mode} />
          ))}
        </section>

        <footer className="flex flex-wrap items-center justify-center gap-x-6 sm:justify-start">
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center text-sm text-zinc-400 hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            Settings
          </Link>
          {user ? (
            <form
              action={signOutAction}
              className="flex items-center gap-2 text-sm text-zinc-400"
            >
              <span>Signed in as {user.username} ·</span>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center text-zinc-300 underline hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-sm text-zinc-400 hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Sign in for online leagues
            </Link>
          )}
        </footer>
      </div>
    </main>
  );
}
