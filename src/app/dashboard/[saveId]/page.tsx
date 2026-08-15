import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { AdvanceTimeControls } from "@/components/game/AdvanceTimeControls";
import { EventCard } from "@/components/game/EventCard";
import { ObjectiveCard } from "@/components/game/ObjectiveCard";
import {
  NextActionPanel,
  resolveNextActionPresentation,
} from "@/components/game/NextActionPanel";
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
  const nextAction = resolveNextActionPresentation(dashboard, saveId);

  return (
    <>
      <PageHeader
        title={`${dashboard.controlledTeam.city} ${dashboard.controlledTeam.name}`}
        subtitle={`${save.name} · ${dashboard.leagueName}`}
        actions={
          <AdvanceTimeControls
            saveId={save.id}
            returnPath={returnPath}
            simulationFrequency={dashboard.simulationFrequency}
            disabled={dashboard.userOnDraftClock}
          />
        }
      />

      {error ? <ErrorState message={error} /> : null}

      <NextActionPanel action={nextAction} />

      {dashboard.userOnDraftClock ? (
        <p
          role="status"
          className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
        >
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
          label="Net income"
          value={<MoneyDisplay amount={dashboard.netIncome} />}
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
      </section>

      <Section title="Owner objectives">
        {dashboard.objectives.length === 0 ? (
          <EmptyState message="No objectives yet. Advance the season to generate them." />
        ) : (
          <ul className="space-y-2">
            {dashboard.objectives.map((objective) => (
              <ObjectiveCard
                key={objective.id}
                description={objective.description}
                seasonYear={objective.seasonYear}
                status={objective.status}
                target={objective.target}
                progress={objective.progress}
                consequenceApplied={objective.consequenceApplied}
              />
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Notifications">
          {dashboard.notifications.length === 0 ? (
            <EmptyState message="No recent notifications." />
          ) : (
            <ul className="space-y-2">
              {dashboard.notifications.map((notification) => (
                <EventCard
                  key={notification.id}
                  title={notification.message}
                  type={notification.type}
                  severity={notification.severity}
                  read={notification.read}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent activity">
          {dashboard.recentActivity.length === 0 ? (
            <EmptyState message="No events yet. Advance the day to generate activity." />
          ) : (
            <ul className="space-y-2">
              {dashboard.recentActivity.map((entry) => (
                <EventCard
                  key={entry.id}
                  title={entry.description}
                  date={entry.occurredOn}
                  type={entry.type}
                  amount={entry.amount}
                />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Upcoming">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300">
              <span>
                Phase: {dashboard.seasonPhase}
                {dashboard.offseasonStage !== "none"
                  ? ` / ${dashboard.offseasonStage}`
                  : ""}
              </span>
              <StatusBadge
                label={`Playoffs: ${dashboard.playoffs.status}`}
                tone={dashboard.playoffs.userQualified ? "success" : "info"}
              />
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
      </div>
    </>
  );
}
