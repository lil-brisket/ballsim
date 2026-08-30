"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InjuryReportView, InjuryRowView } from "@/state/team-management-selectors";
import { EmptyState } from "@/components/owner/EmptyState";
import { StatusBadge } from "@/components/owner/StatusBadge";

type InjuryFilter =
  | "all"
  | "out"
  | "limited"
  | "questionable"
  | "minor"
  | "returning"
  | "long_term"
  | "high_reinjury";

const FILTERS: Array<{ id: InjuryFilter; label: string }> = [
  { id: "all", label: "All injuries" },
  { id: "out", label: "Out" },
  { id: "limited", label: "Limited" },
  { id: "questionable", label: "Questionable" },
  { id: "minor", label: "Minor" },
  { id: "returning", label: "Returning" },
  { id: "long_term", label: "Long-term" },
  { id: "high_reinjury", label: "High reinjury risk" },
];

function matchesFilter(row: InjuryRowView, filter: InjuryFilter): boolean {
  if (row.status === "available" && filter !== "all") {
    return false;
  }
  switch (filter) {
    case "all":
      return row.status !== "available";
    case "out":
      return row.status === "out" || row.status === "suspended";
    case "limited":
      return row.status === "limited";
    case "questionable":
      return row.status === "questionable";
    case "minor":
      return row.status === "minor";
    case "returning":
      return row.status === "recovery";
    case "long_term":
      return row.isLongTerm;
    case "high_reinjury":
      return row.isHighReinjuryRisk;
  }
}

function formatReturn(row: InjuryRowView): string {
  if (row.expectedReturnEarliest != null && row.expectedReturnLatest != null) {
    if (row.expectedReturnEarliest === row.expectedReturnLatest) {
      return row.expectedReturnEarliest;
    }
    return `${row.expectedReturnEarliest} – ${row.expectedReturnLatest}`;
  }
  if (row.gamesRemaining != null) {
    if (row.gamesRemaining.min === row.gamesRemaining.max) {
      return `~${row.gamesRemaining.min}d`;
    }
    return `~${row.gamesRemaining.min}–${row.gamesRemaining.max}d`;
  }
  return "—";
}

function InjuryPlayerCard(props: {
  saveId: string;
  row: InjuryRowView;
}) {
  const { row, saveId } = props;
  const recoveryPct =
    row.recoveryProgress != null
      ? `${Math.round(row.recoveryProgress * 100)}%`
      : "—";
  const effects =
    row.temporaryEffects.length > 0
      ? row.temporaryEffects
          .filter((e) => e.delta !== 0)
          .map((e) => `${e.delta > 0 ? "+" : ""}${e.delta} ${e.attribute}`)
          .join(", ")
      : "None";

  return (
    <Link
      href={`/dashboard/${saveId}/players/${row.playerId}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition hover:border-zinc-600 hover:bg-zinc-900/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            {row.firstName} {row.lastName}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {row.position} · OVR {row.overall}
            {row.activeInjuryCount > 1
              ? ` · ${row.activeInjuryCount} active injuries`
              : null}
          </div>
        </div>
        <StatusBadge label={row.statusLabel} tone={row.status} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
        <div>
          <div className="text-zinc-500">Injury</div>
          <div className="text-zinc-200">
            {row.isLegacyUndisclosed
              ? "Undisclosed"
              : row.injuryType ?? "—"}
            {row.bodyPart && row.bodyPart !== "unknown"
              ? ` (${row.bodyPart})`
              : ""}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Severity</div>
          <div className="capitalize text-zinc-200">{row.severity ?? "—"}</div>
        </div>
        <div>
          <div className="text-zinc-500">Recovery</div>
          <div className="text-zinc-200">{recoveryPct}</div>
        </div>
        <div>
          <div className="text-zinc-500">Expected return</div>
          <div className="text-zinc-200">{formatReturn(row)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Game / Practice</div>
          <div className="capitalize text-zinc-200">
            {row.gameRestriction ?? "—"} / {row.practiceRestriction ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Minutes</div>
          <div className="font-mono text-zinc-200">
            Rec {row.recommendedWorkloadMpg ?? "—"} / Max{" "}
            {row.maximumWorkloadMpg ?? "—"}
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-zinc-500">Effects</div>
          <div className="text-zinc-200">{effects}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-zinc-500">Reinjury risk</div>
          <div className="text-zinc-200">
            {row.reinjuryRisk != null
              ? `${Math.round(row.reinjuryRisk * 100)}%${
                  row.isHighReinjuryRisk ? " · elevated" : ""
                }`
              : "—"}
          </div>
        </div>
        {row.recentHistory.length > 0 ? (
          <div className="sm:col-span-2">
            <div className="text-zinc-500">Recent history</div>
            <ul className="mt-1 space-y-0.5 text-zinc-300">
              {row.recentHistory.map((entry, index) => (
                <li key={`${entry.injuredOn}-${index}`}>
                  {entry.type} ({entry.bodyPart}) · {entry.severity}
                  {entry.isReinjury ? " · reinjury" : ""}
                  {entry.isAggravation ? " · aggravation" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function InjuryTable(props: {
  saveId: string;
  report: InjuryReportView;
}) {
  const [filter, setFilter] = useState<InjuryFilter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    let filtered = props.report.rows.filter((row) => matchesFilter(row, filter));
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((row) =>
        `${row.firstName} ${row.lastName} ${row.position} ${row.statusLabel} ${row.injuryType ?? ""} ${row.bodyPart ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    return filtered;
  }, [props.report.rows, filter, query]);

  if (props.report.injuredCount === 0 && query === "" && filter === "all") {
    return <EmptyState message="No injuries on the roster." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setFilter(entry.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === entry.id
                ? "border-amber-600 bg-amber-950/40 text-amber-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search player, injury, body part…"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
      />

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-300">
          Current injuries
        </h2>
        {rows.length === 0 ? (
          <EmptyState message="No players match this filter." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <InjuryPlayerCard
                key={row.playerId}
                saveId={props.saveId}
                row={row}
              />
            ))}
          </div>
        )}
      </section>

      {props.report.historyRows.length > 0 ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">
            Recent injury history (roster)
          </h2>
          <ul className="space-y-1 text-xs text-zinc-400">
            {props.report.historyRows.slice(0, 12).map((entry, index) => (
              <li key={`${entry.injuredOn}-${entry.type}-${index}`}>
                {entry.injuredOn}: {entry.type} ({entry.bodyPart}) ·{" "}
                {entry.severity}
                {entry.isReinjury ? " · reinjury" : ""}
                {entry.isAggravation ? " · aggravation" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
