import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";
import { StatusBadge } from "@/components/owner/StatusBadge";

type TeamPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Team overview composed from existing dashboard snapshot + roster view.
 * No new selector/view model.
 */
export default async function TeamOverviewPage({
  params,
  searchParams,
}: TeamPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const { dashboard, roster } = view;
  const healthy = roster.filter((p) => p.injuryKind === "healthy").length;
  const injured = roster.length - healthy;

  return (
    <>
      <PageHeader
        title="Team"
        subtitle={`${dashboard.controlledTeam.city} ${dashboard.controlledTeam.name}`}
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Record"
          value={`${dashboard.controlledStanding.wins}-${dashboard.controlledStanding.losses}`}
        />
        <StatCard label="Standings" value={`#${dashboard.standingsRank}`} />
        <StatCard label="Roster size" value={`${roster.length}`} />
        <StatCard
          label="Payroll"
          value={<MoneyDisplay amount={dashboard.payroll} />}
        />
        <StatCard
          label="Cap space"
          value={<MoneyDisplay amount={dashboard.capSpace} />}
        />
        <StatCard label="Healthy" value={`${healthy}`} />
        <StatCard label="Injured" value={`${injured}`} />
        <StatCard
          label="Phase"
          value={`${dashboard.seasonPhase}${
            dashboard.offseasonStage !== "none"
              ? ` / ${dashboard.offseasonStage}`
              : ""
          }`}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Upcoming games">
          {dashboard.upcomingGames.length === 0 ? (
            <EmptyState message="No upcoming scheduled games." />
          ) : (
            <ul className="space-y-2">
              {dashboard.upcomingGames.map((game) => (
                <li
                  key={game.gameId}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-2 text-sm"
                >
                  <span className="font-mono text-zinc-500">{game.date}</span>
                  <span className="text-zinc-200">
                    {game.home ? "vs" : "@"} {game.opponentAbbreviation}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm">
            <Link
              href={`/dashboard/${saveId}/schedule`}
              className="text-amber-400 hover:underline"
            >
              Full schedule →
            </Link>
          </p>
        </Section>

        <Section title="Recent results">
          {dashboard.recentResults.length === 0 ? (
            <EmptyState message="No final games yet." />
          ) : (
            <ul className="space-y-2">
              {dashboard.recentResults.map((result) => (
                <li
                  key={`${result.date}-${result.opponentAbbreviation}-${result.home}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-2 text-sm"
                >
                  <span className="font-mono text-zinc-500">{result.date}</span>
                  <span
                    className={
                      result.won ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {result.home ? "vs" : "@"} {result.opponentAbbreviation}{" "}
                    {result.teamScore}-{result.opponentScore}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Roster snapshot">
        {roster.length === 0 ? (
          <EmptyState message="No players on the roster." />
        ) : (
          <ul className="space-y-2">
            {roster.slice(0, 8).map((player) => (
              <li
                key={player.playerId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm"
              >
                <Link
                  href={`/dashboard/${saveId}/players/${player.playerId}`}
                  className="font-medium text-zinc-100 hover:text-amber-400"
                >
                  {player.firstName} {player.lastName}
                </Link>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="font-mono text-xs">{player.position}</span>
                  <StatusBadge
                    label={player.injuryKind}
                    tone={player.injuryKind}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <Link
            href={`/dashboard/${saveId}/roster`}
            className="text-amber-400 hover:underline"
          >
            Full roster →
          </Link>
        </p>
      </Section>
    </>
  );
}
