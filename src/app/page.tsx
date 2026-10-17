import Link from "next/link";
import { GameBrand } from "@/components/game/GameBrand";
import { SplashBackground } from "@/components/game/SplashBackground";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/styles";

export default function SplashPage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <SplashBackground className="splash-court-animate" prominent />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <div className="splash-enter-brand">
          <GameBrand size="splash" />
        </div>
        <div className="splash-enter-action">
          <Link
            href="/home"
            className={cn(
              buttonClass({ variant: "primary", size: "lg" }),
              "min-h-14 px-12 text-2xl shadow-team-glow",
            )}
          >
            Enter Game
          </Link>
        </div>
      </div>
    </main>
  );
}
