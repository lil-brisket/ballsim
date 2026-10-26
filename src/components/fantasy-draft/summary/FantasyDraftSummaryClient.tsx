"use client";

import { useState } from "react";
import { continueAfterFantasyDraftAction } from "@/application/actions";
import type { FantasyDraftSummaryView } from "@/state/selectors";
import type { FantasyDraftTeamSummary } from "@/domain/entities/fantasy-draft";
import { buttonClass } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Tabs } from "@/components/ui/Tabs";

function Stars(props: { count: number }) {
  return (
    <span
      className="tracking-tight text-team-ink"
      aria-label={`${props.count} stars`}
    >
      {"★".repeat(props.count)}
      <span className="text-disabled">
        {"☆".repeat(Math.max(0, 5 - props.count))}
      </span>
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
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-high">
      <div
        className="h-full rounded-full bg-team-ink"
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
      <div className="rounded-lg border border-line p-3 text-sm text-faint">
        {props.title}: —
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <div className="text-sm text-muted">{props.title}</div>
      <div className="mt-1 font-medium text-ink">
        {props.pick.playerName} — Pick #{props.pick.pickNumber}
      </div>
      <div className="text-muted">
        {props.pick.position} · {props.pick.overall} OVR /{" "}
        {props.pick.potential} POT
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
        <SectionHeading title={teamName} size="lg" />
        <p className="mt-1 text-sm text-muted">Fantasy Draft Complete</p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <div className="text-sm text-muted">Draft Grade</div>
            <div className="text-4xl font-bold text-team-ink">
              {summary.draftGrade}
            </div>
            <div className="text-sm text-muted">{summary.draftGradeLabel}</div>
          </div>
          <div className="text-sm text-muted">
            {summary.playerCount} players selected · Avg OVR {summary.avgOvr} ·
            Avg POT {summary.avgPot} · Avg age {summary.avgAge}
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-line p-4">
        <SectionHeading as="h3" title="Draft Verdict" />
        <p className="mt-2 text-sm leading-relaxed text-soft">
          {summary.draftVerdict}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <HighlightCard title="Best Pick" pick={summary.bestPick} />
        <HighlightCard title="Biggest Reach" pick={summary.biggestReach} />
        <HighlightCard title="Best Value" pick={summary.bestValue} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-line p-4">
          <SectionHeading as="h3" title="Strengths" />
          <ul className="mt-2 space-y-1 text-sm text-emerald-300/90">
            {summary.strengths.length === 0 ? (
              <li className="text-faint">—</li>
            ) : (
              summary.strengths.map((s) => <li key={s}>{s}</li>)
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-line p-4">
          <SectionHeading as="h3" title="Concerns" />
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {summary.concerns.length === 0 ? (
              <li className="text-faint">—</li>
            ) : (
              summary.concerns.map((c) => <li key={c}>{c}</li>)
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-line p-4">
        <SectionHeading as="h3" title="Team Outlook" />
        <p className="mt-2 text-sm text-soft">
          {summary.teamOutlook.narrative}
        </p>
        <p className="mt-1 text-sm text-faint">
          Short term: {summary.teamOutlook.shortTerm} · Long term:{" "}
          {summary.teamOutlook.longTerm}
        </p>
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-soft">Roster Balance</h4>
          {summary.positionBalance.map((row) => (
            <div key={row.position} className="flex items-center gap-3 text-sm">
              <span className="w-8 text-soft">{row.position}</span>
              <BalanceBar level={row.level} />
              <span className="w-28 text-right text-sm text-muted">
                {row.level}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line p-4">
        <SectionHeading as="h3" title="Draft Value" />
        <p className="mt-2 text-sm text-soft">
          {summary.strongValuePickCount} of {summary.playerCount} picks were
          rated as strong value selections.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {summary.pickBreakdown.map((row) => (
            <li key={row.pickNumber} className="flex items-center gap-2">
              <span className="w-16 text-faint">Pick {row.pickNumber}</span>
              <Stars count={row.valueStars} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line p-4">
        <SectionHeading as="h3" title="Draft Breakdown" className="mb-3" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-faint">
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
                <tr key={row.pickNumber} className="border-t border-line">
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

      <section className="rounded-xl border border-team-ink/50 bg-team/20 p-4">
        <SectionHeading as="h3" title={"What's Next?"} />
        <ul className="mt-2 space-y-1 text-sm text-soft">
          {summary.recommendedNextSteps.map((step, i) => (
            <li key={step}>
              {i === 0 ? (
                <span className="font-medium text-team-ink">Priority: </span>
              ) : null}
              {step}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a
            href={`/dashboard/${props.saveId}/free-agency`}
            className="rounded border border-line-strong px-2 py-1 text-soft hover:border-faint"
          >
            Free agency
          </a>
          <a
            href={`/dashboard/${props.saveId}/roster`}
            className="rounded border border-line-strong px-2 py-1 text-soft hover:border-faint"
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
    <section className="rounded-xl border border-line p-5">
      <SectionHeading title="League Draft Recap" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {awards.map(({ label, award }) => (
          <div
            key={label}
            className="rounded-lg border border-line p-3 text-sm"
          >
            <div className="text-sm text-muted">{label}</div>
            {award ? (
              <>
                <div className="mt-1 font-medium text-ink">
                  {award.teamName}
                  {award.playerName ? ` — ${award.playerName}` : ""}
                </div>
                <div className="text-sm text-faint">{award.detail}</div>
              </>
            ) : (
              <div className="mt-1 text-faint">—</div>
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
        <SectionHeading as="h1" size="lg" title="Fantasy Draft Complete" />
        <p className="mt-1 text-sm text-muted">
          {view.selectionsMade} picks · {view.undraftedCount} undrafted free
          agents
        </p>
      </header>

      {controlled.length > 0 ? (
        <Tabs
          aria-label="Controlled franchises"
          activeKey={activeTeamId}
          items={controlled.map((teamId) => {
            const meta = view.teamNames[teamId];
            const grade = view.teamSummaries[teamId]?.draftGrade ?? "—";
            return {
              key: teamId,
              label: meta?.name ?? teamId,
              badge: <span className="text-team-ink">{grade}</span>,
              onSelect: () => setActiveTeamId(teamId),
            };
          })}
        />
      ) : null}

      {summary && teamMeta ? (
        <TeamSummaryPanel
          saveId={saveId}
          teamName={teamMeta.name}
          summary={summary}
        />
      ) : (
        <p className="text-sm text-faint">No team summary available.</p>
      )}

      <LeagueRecapPanel view={view} />

      <form action={continueAfterFantasyDraftAction}>
        <input type="hidden" name="saveId" value={saveId} />
        <button type="submit" className={buttonClass({ variant: "primary" })}>
          Continue League
        </button>
      </form>
    </main>
  );
}
