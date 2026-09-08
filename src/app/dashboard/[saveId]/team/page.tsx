import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { GameRow } from "@/components/basketball/GameRow";
import { RosterRow } from "@/components/basketball/RosterRow";
import { TeamCard } from "@/components/basketball/TeamCard";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { TeamDecisionsList } from "@/components/team/TeamDecisionsList";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { cn, panelClass } from "@/components/ui/styles";

type TeamPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Team Hub — management workspace (sections + lists, not a card dashboard).
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

  const hub = view.teamHub;
  const rotationHref = `/dashboard/${saveId}/team-management/rotations`;
  const rosterHref = `/dashboard/${saveId}/roster`;

  return (
    <div className="space-y-8">
      <TeamHubSubNav saveId={saveId} active="team" />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
            Team Hub
          </p>
          <h1 className="mt-1 text-2xl font-medium text-zinc-50">
            {hub.city} {hub.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {hub.wins}–{hub.losses} · #{hub.leagueRank}
            {hub.recentForm.streak ? ` · ${hub.recentForm.streak}` : ""}
            {" · "}
            {hub.seasonPhase}
            {hub.offseasonStage !== "none" ? ` / ${hub.offseasonStage}` : ""}
          </p>
        </div>
        <TeamCard
          city={hub.city}
          name={hub.name}
          abbreviation={hub.abbreviation}
          branding={hub.branding}
          wins={hub.wins}
          losses={hub.losses}
          rank={hub.leagueRank}
        />
      </header>

      {error ? <ErrorState message={error} /> : null}

      <Section title="Team Snapshot">
        <dl
          className={cn(
            panelClass,
            "grid grid-cols-2 gap-3 px-4 py-4 text-sm sm:grid-cols-4",
          )}
        >
          <div>
            <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
              Record
            </dt>
            <dd className="font-mono text-zinc-100">
              {hub.wins}–{hub.losses}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
              Rank
            </dt>
            <dd className="font-mono text-zinc-100">#{hub.leagueRank}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
              Form (L5)
            </dt>
            <dd className="font-mono text-zinc-100">
              {hub.recentForm.marks || "—"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
              Health
            </dt>
            <dd className="text-zinc-100">
              {hub.healthyCount} healthy
              {hub.injuredCount > 0 ? (
                <span className="text-rose-400">
                  {" "}
                  · {hub.injuredCount} injured
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        title="Rotation"
        action={
          <Link href={rotationHref} className="text-sm text-amber-400">
            Manage Rotation
          </Link>
        }
      >
        <div className={cn(panelClass, "divide-y divide-zinc-800")}>
          <div className="px-4 py-2">
            <p className="font-mono text-[0.65rem] uppercase text-zinc-500">
              Starters
            </p>
            {hub.rotation.starters.length === 0 ? (
              <EmptyState message="No starters configured." />
            ) : (
              <ul className="mt-1">
                {hub.rotation.starters.map((row) => (
                  <li
                    key={row.playerId}
                    className="flex items-center justify-between gap-2 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="mr-2 font-mono text-xs text-zinc-500">
                        {row.position}
                      </span>
                      <PlayerEntityLink
                        saveId={saveId}
                        playerId={row.playerId}
                      >
                        {row.firstName} {row.lastName}
                      </PlayerEntityLink>
                    </span>
                    <span className="shrink-0 font-mono text-zinc-300">
                      {row.targetMinutes} MPG
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-4 py-2">
            <p className="font-mono text-[0.65rem] uppercase text-zinc-500">
              Bench
            </p>
            {hub.rotation.bench.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">No bench minutes set.</p>
            ) : (
              <ul className="mt-1">
                {hub.rotation.bench.map((row) => (
                  <li
                    key={row.playerId}
                    className="flex items-center justify-between gap-2 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="mr-2 font-mono text-xs text-zinc-500">
                        {row.position}
                      </span>
                      <PlayerEntityLink
                        saveId={saveId}
                        playerId={row.playerId}
                      >
                        {row.firstName} {row.lastName}
                      </PlayerEntityLink>
                    </span>
                    <span className="shrink-0 font-mono text-zinc-300">
                      {row.targetMinutes} MPG
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-zinc-500">
            <span>
              {hub.rotation.totalPlanned} / {hub.rotation.target} minutes
              {!hub.rotation.plannedValid ? (
                <span className="ml-2 text-amber-400">
                  (Δ {hub.rotation.delta})
                </span>
              ) : null}
            </span>
            <Link
              href={rotationHref}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-zinc-200 hover:border-amber-600"
            >
              Manage Rotation
            </Link>
          </div>
        </div>
      </Section>

      <Section
        title="Roster"
        action={
          <Link href={rosterHref} className="text-sm text-amber-400">
            View Roster
          </Link>
        }
      >
        <div className={cn(panelClass, "px-4 py-2")}>
          {hub.corePlayers.map((player) => (
            <RosterRow
              key={player.playerId}
              saveId={saveId}
              playerId={player.playerId}
              firstName={player.firstName}
              lastName={player.lastName}
              position={player.position}
              overall={player.overall}
              age={player.age}
              injuryStatus={
                player.injuryKind !== "available"
                  ? player.injuryKind
                  : undefined
              }
            />
          ))}
          {hub.injuredPlayers.length > 0 ? (
            <div className="mt-3 border-t border-zinc-800 pt-2">
              <p className="mb-1 font-mono text-[0.65rem] uppercase text-rose-400">
                Injured
              </p>
              {hub.injuredPlayers.map((player) => (
                <RosterRow
                  key={`inj-${player.playerId}`}
                  saveId={saveId}
                  playerId={player.playerId}
                  firstName={player.firstName}
                  lastName={player.lastName}
                  position={player.position}
                  overall={player.overall}
                  injuryStatus={player.injuryKind}
                />
              ))}
            </div>
          ) : null}
          <div className="py-2">
            <Link
              href={rosterHref}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              View Roster →
            </Link>
          </div>
        </div>
      </Section>

      <Section
        title="Upcoming"
        action={
          <Link
            href={`/dashboard/${saveId}/schedule`}
            className="text-sm text-amber-400"
          >
            Schedule
          </Link>
        }
      >
        {hub.upcomingGames.length === 0 ? (
          <EmptyState message="No upcoming scheduled games." />
        ) : (
          <ul className="space-y-2">
            {hub.upcomingGames.map((game) => (
              <li key={game.gameId}>
                <GameRow
                  saveId={saveId}
                  gameId={game.gameId}
                  date={game.date}
                  home={game.home}
                  opponentAbbreviation={game.opponentAbbreviation}
                  opponentName={game.opponentName}
                  opponentTeamId={game.opponentTeamId}
                  opponentBranding={game.opponentBranding}
                  calendarHref={`/dashboard/${saveId}/calendar?date=${game.date}`}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <TeamDecisionsList items={hub.decisions} saveId={saveId} />
    </div>
  );
}
