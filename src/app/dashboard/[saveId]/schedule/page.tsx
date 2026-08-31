import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { GameResultLink } from "@/components/owner/GameResultLink";
import { PageHeader } from "@/components/owner/PageHeader";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";

type SchedulePageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function SchedulePage({
  params,
  searchParams,
}: SchedulePageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const currentDate = view.dashboard.currentDate;

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`World date ${currentDate} · controlled team games`}
      />
      {error ? <ErrorState message={error} /> : null}
      {view.schedule.length === 0 ? (
        <EmptyState message="No games on the schedule yet." />
      ) : (
        <DataTable headers={["Date", "Matchup", "Status", "Event", "Result"]}>
          {view.schedule.map((game) => {
            const isCurrent = game.date === currentDate;
            const isPast = game.date < currentDate;
            const isFinal = game.status === "final";
            const resultCell =
              game.teamScore !== null && game.opponentScore !== null ? (
                <span
                  className={
                    game.won ? "text-emerald-400" : "text-rose-400"
                  }
                >
                  {game.teamScore}-{game.opponentScore}
                </span>
              ) : (
                <span className="text-zinc-600">—</span>
              );
            return (
              <tr
                key={game.gameId}
                className={`border-t border-zinc-800 ${
                  isCurrent
                    ? "bg-amber-950/30"
                    : isPast
                      ? "opacity-70"
                      : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-zinc-500">
                  {game.date}
                  {isCurrent ? (
                    <span className="ml-2 text-xs text-amber-400">today</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-zinc-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-zinc-500">
                      {game.home ? "vs" : "@"}
                    </span>
                    {game.opponentBranding ? (
                      <span
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-700"
                        style={{
                          backgroundColor: game.opponentBranding.primaryColor,
                        }}
                      >
                        <TeamLogoMark
                          branding={game.opponentBranding}
                          size="sm"
                          decorative
                        />
                      </span>
                    ) : (
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-amber-700/40 bg-amber-950/50 font-mono text-[10px] font-semibold text-amber-400">
                        {game.opponentAbbreviation}
                      </span>
                    )}
                    <span>
                      {game.opponentName}{" "}
                      <span className="font-mono text-zinc-500">
                        ({game.opponentAbbreviation})
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-400">{game.status}</td>
                <td className="px-3 py-2 text-sm">
                  {game.home ? (
                    <Link
                      href={`/dashboard/${saveId}/schedule/${game.gameId}/event`}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      {game.gameDayPromotion
                        ? game.gameDayPromotion.name
                        : "Manage event"}
                    </Link>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isFinal ? (
                    <GameResultLink
                      saveId={saveId}
                      gameId={game.gameId}
                      canOpen
                      showHint
                    >
                      {resultCell}
                    </GameResultLink>
                  ) : (
                    resultCell
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
