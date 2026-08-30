"use client";

import { useState } from "react";
import { continueAfterFantasyDraftAction } from "@/application/actions";
import type { FantasyDraftSummaryView } from "@/state/selectors";
import type { FantasyDraftTeamSummary } from "@/domain/entities/fantasy-draft";

function Stars(props: { count: number }) {
  return (
    <span className="tracking-tight text-amber-400" aria-label={`${props.count} stars`}>
      {"★".repeat(props.count)}
      <span className="text-zinc-600">{"☆".repeat(Math.max(0, 5 - props.count))}</span>
    </span>
  );
}

function BalanceBar(props: { level: string }) {
  const widths: Record<string, string> = {
    Excellent: "100%",
    Good: "80%",
    Average: "60%",
    "Below Average": "40%",
    Weak: "25%",
  };
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
      <div
        className="h-full rounded-full bg-amber-500"
        style={{ width: widths[props.level] ?? "40%" }}
      />
    </div>
  );
}

function HighlightCard(props: {
  title: string;
  pick: FantasyDraftTeamSummary["bestPick"];
}) {
  if (!props.pick) {
    return (
      <div className="rounded-lg border border-zinc-800 p-3 text-sm text-zinc-500">
        {props.title}: —
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-800 p-3 text-sm">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {props.title}
      </div>
      <div className="mt-1 font-medium text-zinc-100">
        {props.pick.playerName} — Pick #{props.pick.pickNumber}
      </div>
      <div className="text-zinc-400">
        {props.pick.position} · {props.pick.overall} OVR / {props.pick.potential}{" "}
        POT
      </div>
    </div>
  );
}

function TeamSummaryPanel(props: {
  saveId: string;
  teamName: string;
  summary: FantasyDraftTeamSummary;
}) {
  const { summary, teamName } = props;
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-zinc-50">{teamName}</h2>
        <p className="mt-1 text-sm text-zinc-400">Fantasy Draft Complete</p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <div className="text-[10px] uppercase text-zinc-500">Draft Grade</div>
            <div className="text-4xl font-bold text-amber-300">
              {summary.draftGrade}
            </div>
            <div className="text-sm text-zinc-400">{summary.draftGradeLabel}</div>
          </div>
          <div className="text-sm text-zinc-400">
            {summary.playerCount} players selected · Avg OVR {summary.avgOvr} ·
            Avg POT {summary.avgPot} · Avg age {summary.avgAge}
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h3 className="text-sm font-semibold uppercase text-zinc-400">
          Draft Verdict
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          {summary.draftVerdict}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <HighlightCard title="Best Pick" pick={summary.bestPick} />
        <HighlightCard title="Biggest Reach" pick={summary.biggestReach} />
        <HighlightCard title="Best Value" pick={summary.bestValue} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 p-4">
          <h3 className="text-sm font-semibold uppercase text-zinc-400">
            Strengths
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-emerald-300/90">
            {summary.strengths.length === 0 ? (
              <li className="text-zinc-500">—</li>
            ) : (
              summary.strengths.map((s) => <li key={s}>{s}</li>)
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-zinc-800 p-4">
          <h3 className="text-sm font-semibold uppercase text-zinc-400">
            Concerns
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            {summary.concerns.length === 0 ? (
              <li className="text-zinc-500">—</li>
            ) : (
              summary.concerns.map((c) => <li key={c}>{c}</li>)
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h3 className="text-sm font-semibold uppercase text-zinc-400">
          Team Outlook
        </h3>
        <p className="mt-2 text-sm text-zinc-300">
          {summary.teamOutlook.narrative}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Short term: {summary.teamOutlook.shortTerm} · Long term:{" "}
          {summary.teamOutlook.longTerm}
        </p>
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase text-zinc-500">
            Roster Balance
          </h4>
          {summary.positionBalance.map((row) => (
            <div key={row.position} className="flex items-center gap-3 text-sm">
              <span className="w-8 font-mono text-zinc-300">{row.position}</span>
              <BalanceBar level={row.level} />
              <span className="w-28 text-right text-xs text-zinc-400">
                {row.level}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h3 className="text-sm font-semibold uppercase text-zinc-400">
          Draft Value
        </h3>
        <p className="mt-2 text-sm text-zinc-300">
          {summary.strongValuePickCount} of {summary.playerCount} picks were
          rated as strong value selections.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {summary.pickBreakdown.map((row) => (
            <li key={row.pickNumber} className="flex items-center gap-2">
              <span className="w-16 text-zinc-500">Pick {row.pickNumber}</span>
              <Stars count={row.valueStars} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
          Draft Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1">Pick</th>
                <th>Player</th>
                <th>Pos</th>
                <th>OVR</th>
                <th>POT</th>
                <th>Age</th>
                <th>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {summary.pickBreakdown.map((row) => (
                <tr key={row.pickNumber} className="border-t border-zinc-800">
                  <td className="py-1.5">{row.pickNumber}</td>
                  <td>{row.playerName}</td>
                  <td>{row.position}</td>
                  <td>{row.overall}</td>
                  <td>{row.potential}</td>
                  <td>{row.age}</td>
                  <td>{row.assessment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
        <h3 className="text-sm font-semibold uppercase text-amber-300/80">
          What&apos;s Next?
        </h3>
        <ul className="mt-2 space-y-1 text-sm text-zinc-300">
          {summary.recommendedNextSteps.map((step, i) => (
            <li key={step}>
              {i === 0 ? (
                <span className="font-medium text-amber-200">Priority: </span>
              ) : null}
              {step}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a
            href={`/dashboard/${props.saveId}/free-agency`}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
          >
            Free agency
          </a>
          <a
            href={`/dashboard/${props.saveId}/roster`}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
          >
            Roster
          </a>
        </div>
      </section>
    </div>
  );
}

function LeagueRecapPanel(props: { view: FantasyDraftSummaryView }) {
  const recap = props.view.leagueRecap;
  if (!recap) return null;

  const awards = [
    { label: "Best Draft", award: recap.bestDraft },
    { label: "Biggest Steal", award: recap.biggestSteal },
    { label: "Biggest Reach", award: recap.biggestReach },
    { label: "Most Aggressive", award: recap.mostAggressive },
    { label: "Youngest Draft", award: recap.youngestDraft },
    { label: "Highest Avg OVR", award: recap.highestAvgOvr },
    { label: "Highest Avg Potential", award: recap.highestAvgPot },
  ];

  return (
    <section className="rounded-xl border border-zinc-800 p-5">
      <h2 className="text-lg font-semibold text-zinc-50">League Draft Recap</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {awards.map(({ label, award }) => (
          <div key={label} className="rounded-lg border border-zinc-800 p-3 text-sm">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              {label}
            </div>
            {award ? (
              <>
                <div className="mt-1 font-medium text-zinc-100">
                  {award.teamName}
                  {award.playerName ? ` — ${award.playerName}` : ""}
                </div>
                <div className="text-xs text-zinc-500">{award.detail}</div>
              </>
            ) : (
              <div className="mt-1 text-zinc-500">—</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function FantasyDraftSummaryClient(props: {
  saveId: string;
  view: FantasyDraftSummaryView;
}) {
  const { saveId, view } = props;
  const controlled = view.controlledTeamIds.filter(
    (id) => view.teamSummaries[id],
  );
  const defaultTeam = controlled[0] ?? Object.keys(view.teamSummaries)[0] ?? "";
  const [activeTeamId, setActiveTeamId] = useState(defaultTeam);
  const summary = view.teamSummaries[activeTeamId];
  const teamMeta = view.teamNames[activeTeamId];

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold text-zinc-50">
          Fantasy Draft Complete
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {view.selectionsMade} picks · {view.undraftedCount} undrafted free
          agents
        </p>
      </header>

      {controlled.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {controlled.map((teamId) => {
            const meta = view.teamNames[teamId];
            const grade = view.teamSummaries[teamId]?.draftGrade ?? "—";
            const active = teamId === activeTeamId;
            return (
              <button
                key={teamId}
                type="button"
                onClick={() => setActiveTeamId(teamId)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  active
                    ? "border-amber-600 bg-amber-950/40 text-amber-100"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {meta?.name ?? teamId}{" "}
                <span className="font-semibold text-amber-300">{grade}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {summary && teamMeta ? (
        <TeamSummaryPanel
          saveId={saveId}
          teamName={teamMeta.name}
          summary={summary}
        />
      ) : (
        <p className="text-sm text-zinc-500">No team summary available.</p>
      )}

      <LeagueRecapPanel view={view} />

      <form action={continueAfterFantasyDraftAction}>
        <input type="hidden" name="saveId" value={saveId} />
        <button
          type="submit"
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          Continue League
        </button>
      </form>
    </main>
  );
}
