import Link from "next/link";
import { listGameModeDefinitions } from "@/application/game-mode-catalog";
import { GameBrand } from "@/components/game/GameBrand";
import { GameModeCard } from "@/components/game/GameModeCard";
import { SplashBackground } from "@/components/game/SplashBackground";
import { ErrorState } from "@/components/owner/EmptyState";

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
        <header className="space-y-3 text-center sm:text-left">
          <GameBrand />
          <p className="mx-auto max-w-xl text-zinc-400 sm:mx-0">
            Build your basketball story.
          </p>
          <h2 className="pt-2 text-lg font-medium text-zinc-200">
            Choose your mode
          </h2>
        </header>

        {error ? <ErrorState message={error} /> : null}

        <section
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-label="Game modes"
        >
          {modes.map((mode) => (
            <GameModeCard key={mode.id} mode={mode} />
          ))}
        </section>

        <footer className="flex justify-center sm:justify-start">
          <Link
            href="/settings"
            className="text-sm text-zinc-500 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            Settings
          </Link>
        </footer>
      </div>
    </main>
  );
}
