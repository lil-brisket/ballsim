import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerGameBoxScoreView } from "@/application/game-service";
import { GameBoxScore } from "@/components/owner/GameBoxScore";
import { PageHeader } from "@/components/owner/PageHeader";

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
          <Link
            href={`/dashboard/${saveId}/schedule`}
            className="text-sm text-zinc-400 hover:text-amber-400"
          >
            ← Schedule
          </Link>
        }
      />
      <GameBoxScore boxScore={boxScore} />
    </>
  );
}
