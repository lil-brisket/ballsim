import Link from "next/link";
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

        <footer className="flex justify-center sm:justify-start">
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center text-sm text-zinc-400 hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            Settings
          </Link>
        </footer>
      </div>
    </main>
  );
}
