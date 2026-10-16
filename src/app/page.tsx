import Link from "next/link";
import { GameBrand } from "@/components/game/GameBrand";
import { SplashBackground } from "@/components/game/SplashBackground";

export default function SplashPage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <SplashBackground className="splash-court-animate" prominent />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <div className="splash-enter-brand">
          <GameBrand size="splash" />
        </div>
        <p className="splash-enter-tagline max-w-md text-lg text-zinc-300 sm:text-xl">
          Build the franchise. Shape the league.
        </p>
        <div className="splash-enter-action">
          <Link
            href="/home"
            className="inline-flex min-h-14 items-center justify-center rounded-xl border-2 border-team-ink bg-team px-12 py-3 font-display text-2xl font-extrabold uppercase tracking-[0.15em] text-on-team shadow-team-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-team-ink"
          >
            Enter Game
          </Link>
        </div>
      </div>
    </main>
  );
}
