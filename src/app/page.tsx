import Link from "next/link";
import { GameBrand } from "@/components/game/GameBrand";
import { SplashBackground } from "@/components/game/SplashBackground";

export default function SplashPage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <SplashBackground className="splash-court-animate" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <div className="splash-enter-brand">
          <GameBrand size="splash" />
        </div>
        <p className="splash-enter-tagline max-w-md text-lg text-zinc-400 sm:text-xl">
          Build the franchise. Shape the league.
        </p>
        <div className="splash-enter-action">
          <Link
            href="/home"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-8 py-3 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            Enter Game
          </Link>
        </div>
      </div>
    </main>
  );
}
