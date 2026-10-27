import type { Metadata } from "next";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerGameBoxScoreView } from "@/application/game-service";
import { GameBoxScore } from "@/components/owner/GameBoxScore";
import { GameRotationPanel } from "@/components/owner/GameRotationPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Game" };

type GamePageProps = {
  params: Promise<{ saveId: string; gameId: string }>;
};

export default async function GameBoxScorePage({ params }: GamePageProps) {
  const { saveId, gameId } = await params;
  const view = await loadOwnerGameBoxScoreView(saveId, gameId);
  if (!view) {
    notFound();
  }

  const { boxScore } = view;

  return (
    <>
      <PageHeader
        title="Box score"
        subtitle={`${boxScore.away.abbreviation} @ ${boxScore.home.abbreviation}`}
        actions={
          <>
            {view.canWatch ? (
              <Link
                href={`/dashboard/${saveId}/games/${gameId}/watch`}
                className={cn(
                  linkClass,
                  touchTargetTextClass,
                  focusRingClass,
                  "text-sm",
                )}
              >
                Watch replay →
              </Link>
            ) : null}
            <Link
              href={`/dashboard/${saveId}/schedule`}
              className={cn(
                touchTargetTextClass,
                focusRingClass,
                "text-sm text-soft hover:text-team-ink",
              )}
            >
              ← Schedule
            </Link>
          </>
        }
      />
      <GameBoxScore boxScore={boxScore} />
      {boxScore.rotation ? (
        <div className="mt-8">
          <GameRotationPanel
            rotation={boxScore.rotation}
            homeAbbreviation={boxScore.home.abbreviation}
            awayAbbreviation={boxScore.away.abbreviation}
          />
        </div>
      ) : null}
    </>
  );
}
