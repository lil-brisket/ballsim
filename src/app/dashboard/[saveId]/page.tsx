import Link from "next/link";
import { notFound } from "next/navigation";
import {
  advanceDayAction,
  advanceUntilPhaseAction,
  advanceWeekAction,
  draftProspectAction,
  executeTradeAction,
  finishFreeAgencyAction,
  signFreeAgentAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";

type DashboardPageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { saveId } = await params;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const { save, dashboard, roster, standings, freeAgents, draftBoard } = view;
  const tradeOutgoingId = roster[roster.length - 1]?.playerId;
  const isFreeAgency =
    dashboard.seasonPhase === "offseason" &&
    dashboard.offseasonStage === "free_agency";
  const isDraft =
    dashboard.seasonPhase === "offseason" &&
    dashboard.offseasonStage === "draft";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-zinc-400 hover:text-amber-400">
          ← Saves
        </Link>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          Owner Mode
        </p>
      </div>

      <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {dashboard.controlledTeam.city} {dashboard.controlledTeam.name}
          </h1>
          <p className="text-zinc-400">
            {save.name} · {dashboard.leagueName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={advanceDayAction}>
            <input type="hidden" name="saveId" value={save.id} />
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
            <button
              type="submit"
              disabled={dashboard.userOnDraftClock}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-600 disabled:opacity-40"
            >
              Until next phase
            </button>
          </form>
        </div>
      </header>

      {dashboard.userOnDraftClock ? (
        <p className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          Your team is on the draft clock. Make a selection below before
          advancing time.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="World date" value={dashboard.currentDate} mono />
        <StatCard
          label="Season"
          value={`${dashboard.seasonYear} (${dashboard.seasonPhase}${
            dashboard.offseasonStage !== "none"
              ? ` / ${dashboard.offseasonStage}`
              : ""
          })`}
        />
        <StatCard
          label="Record"
          value={`${dashboard.controlledStanding.wins}-${dashboard.controlledStanding.losses}`}
        />
        <StatCard
          label="Cap / Cash"
          value={`$${(dashboard.capSpace / 1_000_000).toFixed(1)}M / $${(
            dashboard.cash / 1_000_000
          ).toFixed(1)}M`}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-400">Playoffs</h2>
          <p className="mt-2 text-zinc-100">
            Status: {dashboard.playoffs.status}
            {dashboard.playoffs.fieldSize > 0
              ? ` · field ${dashboard.playoffs.fieldSize}`
              : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {dashboard.playoffs.userQualified
              ? "Your team qualified."
              : dashboard.playoffs.status === "not_started"
                ? "Tournament not started."
                : "Your team did not qualify."}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-400">Notifications</h2>
          {dashboard.notifications.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">None yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
              {dashboard.notifications.map((notification) => (
                <li key={notification.id}>
                  <span className="text-zinc-500">[{notification.severity}]</span>{" "}
                  {notification.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-100">Roster</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Pos</th>
                <th className="px-3 py-2">OVR</th>
                <th className="px-3 py-2">Age</th>
                <th className="px-3 py-2">Salary</th>
                <th className="px-3 py-2">Trade</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((player) => (
                <tr key={player.playerId} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-100">
                    {player.firstName} {player.lastName}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{player.position}</td>
                  <td className="px-3 py-2 text-zinc-200">{player.overall}</td>
                  <td className="px-3 py-2 text-zinc-400">{player.age}</td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {player.contractSalary !== null
                      ? `$${(player.contractSalary / 1_000_000).toFixed(1)}M`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {dashboard.seasonPhase === "regular" ||
                    dashboard.seasonPhase === "preseason" ? (
                      <form action={executeTradeAction}>
                        <input type="hidden" name="saveId" value={save.id} />
                        <input
                          type="hidden"
                          name="outgoingPlayerId"
                          value={player.playerId}
                        />
                        <button
                          type="submit"
                          className="text-xs text-amber-400 hover:underline"
                        >
                          Trade
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tradeOutgoingId &&
        (dashboard.seasonPhase === "regular" ||
          dashboard.seasonPhase === "preseason") ? (
          <p className="text-xs text-zinc-500">
            Use Trade on a roster player to execute the first acceptable
            1-for-1 candidate.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-100">Standings</h2>
        <ul className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
          {standings.map((row) => (
            <li
              key={row.teamId}
              className={
                row.isUserTeam
                  ? "font-medium text-amber-300"
                  : "text-zinc-300"
              }
            >
              {row.abbreviation} {row.wins}-{row.losses}
              {row.isUserTeam ? " (you)" : ""}
            </li>
          ))}
        </ul>
      </section>

      {isFreeAgency ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium text-zinc-100">Free agency</h2>
            <form action={finishFreeAgencyAction}>
              <input type="hidden" name="saveId" value={save.id} />
              <button
                type="submit"
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
              >
                Finish free agency → Draft
              </button>
            </form>
          </div>
          <ul className="space-y-2">
            {freeAgents.slice(0, 12).map((agent) => (
              <li
                key={agent.playerId}
                className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-2 text-sm"
              >
                <span className="text-zinc-200">
                  {agent.firstName} {agent.lastName} · {agent.position} · OVR{" "}
                  {agent.overall}
                </span>
                <form action={signFreeAgentAction}>
                  <input type="hidden" name="saveId" value={save.id} />
                  <input type="hidden" name="playerId" value={agent.playerId} />
                  <button
                    type="submit"
                    className="text-amber-400 hover:underline"
                  >
                    Sign
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isDraft && draftBoard ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-100">
            Draft{" "}
            <span className="text-sm font-normal text-zinc-500">
              ({draftBoard.status}
              {draftBoard.onClockOverall !== null
                ? ` · pick ${draftBoard.onClockOverall}`
                : ""}
              )
            </span>
          </h2>
          {draftBoard.userOnClock ? (
            <ul className="space-y-2">
              {draftBoard.eligibleProspects.slice(0, 15).map((prospect) => (
                <li
                  key={prospect.playerId}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-2 text-sm"
                >
                  <span className="text-zinc-200">
                    {prospect.firstName} {prospect.lastName} ·{" "}
                    {prospect.position} · OVR {prospect.overall}
                  </span>
                  <form action={draftProspectAction}>
                    <input type="hidden" name="saveId" value={save.id} />
                    <input
                      type="hidden"
                      name="prospectPlayerId"
                      value={prospect.playerId}
                    />
                    <button
                      type="submit"
                      className="text-amber-400 hover:underline"
                    >
                      Draft
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              Waiting for other teams (or advance after AI fills).
            </p>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-100">Recent results</h2>
        {dashboard.recentResults.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No final games yet. Advance the day when games are scheduled.
          </p>
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
      </section>
    </main>
  );
}

function StatCard(props: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-sm font-medium text-zinc-400">{props.label}</h2>
      <p
        className={`mt-2 text-xl text-zinc-50 ${
          props.mono ? "font-mono" : ""
        }`}
      >
        {props.value}
      </p>
    </div>
  );
}
