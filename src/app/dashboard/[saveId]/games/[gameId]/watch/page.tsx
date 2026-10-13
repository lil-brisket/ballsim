import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerWatchGameView } from "@/application/game-service";
import { WatchGameClient } from "@/components/game/watch/WatchGameClient";
import { WatchGameUnavailable } from "@/components/game/watch/WatchGameUnavailable";
import { PageHeader } from "@/components/owner/PageHeader";

type WatchGamePageProps = {
  params: Promise<{ saveId: string; gameId: string }>;
};

export default async function WatchGamePage({ params }: WatchGamePageProps) {
  const { saveId, gameId } = await params;
  const result = await loadOwnerWatchGameView(saveId, gameId);
  if (!result) {
    notFound();
  }

  const { watch } = result;
  const boxScoreHref = `/dashboard/${saveId}/games/${gameId}`;

  if (watch === null) {
    return (
      <>
        <PageHeader title="Watch game" />
        <div className="mt-6">
          <WatchGameUnavailable saveId={saveId} gameId={gameId} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Watch game"
        subtitle={`${watch.away.abbreviation} @ ${watch.home.abbreviation} · ${watch.date}`}
        actions={
          <Link
            href={boxScoreHref}
            className="text-sm text-zinc-300 hover:text-team-ink"
          >
            Box score →
          </Link>
        }
      />
      <div className="mt-6">
        <WatchGameClient view={watch} saveId={saveId} />
      </div>
    </>
  );
}
