import { notFound } from "next/navigation";
import {
  advanceDayAction,
  advanceUntilPhaseAction,
  advanceWeekAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";
import { StatusBadge } from "@/components/owner/StatusBadge";

type DashboardPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function DashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const { save, dashboard } = view;
  const returnPath = `/dashboard/${saveId}`;

  return (
    <>
      <PageHeader
        title={`${dashboard.controlledTeam.city} ${dashboard.controlledTeam.name}`}
        subtitle={`${save.name} · ${dashboard.leagueName}`}
        actions={
          <>
            <form action={advanceDayAction}>
              <input type="hidden" name="saveId" value={save.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                disabled={dashboard.userOnDraftClock}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-40"
              >
                Advance day
              </button>
            </form>
            <form action={advanceWeekAction}>
              <input type="hidden" name="saveId" value={save.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                disabled={dashboard.userOnDraftClock}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-600 disabled:opacity-40"
              >
                Advance 7 days
              </button>
            </form>
            <form action={advanceUntilPhaseAction}>
              <input type="hidden" name="saveId" value={save.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                disabled={dashboard.userOnDraftClock}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-600 disabled:opacity-40"
              >
                Until next phase
              </button>
            </form>
          </>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      {dashboard.userOnDraftClock ? (
        <p className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          Your team is on the draft clock. Make a selection on the Draft screen
          before advancing time.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="World date" value={dashboard.currentDate} mono />
        <StatCard
          label="Record"
          value={`${dashboard.controlledStanding.wins}-${dashboard.controlledStanding.losses}`}
        />
        <StatCard label="Standings" value={`#${dashboard.standingsRank}`} />
        <StatCard
          label="Cap space"
          value={<MoneyDisplay amount={dashboard.capSpace} />}
        />
        <StatCard
          label="Cash"
          value={<MoneyDisplay amount={dashboard.cash} />}
        />
        <StatCard
          label="Revenue"
          value={<MoneyDisplay amount={dashboard.revenueTotal} />}
        />
        <StatCard
          label="Expenses"
          value={<MoneyDisplay amount={dashboard.expensesTotal} />}
        />
        <StatCard
          label="Payroll"
          value={<MoneyDisplay amount={dashboard.payroll} />}
        />
        <StatCard
          label="Fan sentiment"
          value={`${view.franchiseBusiness.fanSentiment}`}
        />
        <StatCard
          label="Reputation"
          value={`${view.franchiseBusiness.reputation}`}
        />
        <StatCard
          label="Franchise value"
          value={<MoneyDisplay amount={view.franchiseBusiness.franchiseValue} />}
        />
        <StatCard
          label="Arena capacity"
          value={`${view.franchiseBusiness.arenaCapacity}`}
        />
      </section>

      <Section title="Owner objectives">
        {dashboard.objectives.length === 0 ? (
          <EmptyState message="No objectives yet. Advance the season to generate them." />
        ) : (
          <ul className="space-y-2">
            {dashboard.objectives.map((objective) => (
              <li
                key={objective.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div>
                  <p className="text-zinc-100">{objective.description}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {objective.seasonYear}
                    {objective.target !== null
                      ? ` · target ${objective.target}`
                      : ""}
                    {objective.progress !== null
                      ? ` · progress ${objective.progress}`
                      : ""}
                    {objective.consequenceApplied ? " · consequence applied" : ""}
                  </p>
                </div>
                <StatusBadge label={objective.status} tone={objective.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Recent activity">
          {dashboard.recentActivity.length === 0 ? (
            <EmptyState message="No events yet. Advance the day to generate activity." />
          ) : (
            <ul className="space-y-2">
              {dashboard.recentActivity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-2 text-sm"
                >
                  <div>
                    <p className="text-zinc-200">{entry.description}</p>
                    <p className="font-mono text-xs text-zinc-600">
                      {entry.occurredOn} · {entry.type}
                    </p>
                  </div>
                  {entry.amount !== null ? (
                    <MoneyDisplay amount={entry.amount} className="text-zinc-400" />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Upcoming">
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300">
              Phase: {dashboard.seasonPhase}
              {dashboard.offseasonStage !== "none"
                ? ` / ${dashboard.offseasonStage}`
                : ""}
              {" · "}
              Playoffs: {dashboard.playoffs.status}
              {dashboard.playoffs.userQualified ? " (qualified)" : ""}
            </div>
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
          </div>
        </Section>
      </div>

      <Section title="Recent results">
        {dashboard.recentResults.length === 0 ? (
          <EmptyState message="No final games yet." />
        ) : (
          <ul className="space-y-2">
            {dashboard.recentResults.map((result) => (
              <li
                key={`${result.date}-${result.opponentAbbreviation}-${result.home}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm"
              >
                <span className="font-mono text-zinc-500">{result.date}</span>
                <span className="text-zinc-200">
                  {result.home ? "vs" : "@"} {result.opponentAbbreviation}{" "}
                  <span
                    className={
                      result.won ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {result.teamScore}-{result.opponentScore}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
