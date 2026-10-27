"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatGameDate } from "@/presentation/game-date";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  InjuryReportView,
  InjuryRowView,
} from "@/state/team-management-selectors";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { focusRingClass } from "@/components/ui/styles";

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

function InjuryPlayerCard(props: { saveId: string; row: InjuryRowView }) {
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
      className="block rounded-xl border border-line bg-surface-base/60 p-4 transition hover:border-disabled hover:bg-surface-raised/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">
            {row.firstName} {row.lastName}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-faint">
            <span>{row.position}</span>
            <OvrBadge overall={row.overall} size="sm" />
            {row.activeInjuryCount > 1 ? (
              <span>{row.activeInjuryCount} active injuries</span>
            ) : null}
          </div>
        </div>
        <StatusBadge label={row.statusLabel} tone={row.status} />
      </div>

      <div className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
        <div>
          <div className="text-faint">Injury</div>
          <div className="text-ink">
            {row.isLegacyUndisclosed ? "Undisclosed" : (row.injuryType ?? "—")}
            {row.bodyPart && row.bodyPart !== "unknown"
              ? ` (${row.bodyPart})`
              : ""}
          </div>
        </div>
        <div>
          <div className="text-faint">Severity</div>
          <div className="capitalize text-ink">{row.severity ?? "—"}</div>
        </div>
        <div>
          <div className="text-faint">Recovery</div>
          <div className="text-ink">{recoveryPct}</div>
        </div>
        <div>
          <div className="text-faint">Expected return</div>
          <div className="text-ink">{formatReturn(row)}</div>
        </div>
        <div>
          <div className="text-faint">Game / Practice</div>
          <div className="capitalize text-ink">
            {row.gameRestriction ?? "—"} / {row.practiceRestriction ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-faint">Minutes</div>
          <div className="tabular-nums text-ink">
            Rec {row.recommendedWorkloadMpg ?? "—"} / Max{" "}
            {row.maximumWorkloadMpg ?? "—"}
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-faint">Effects</div>
          <div className="text-ink">{effects}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-faint">Reinjury risk</div>
          <div className="text-ink">
            {row.reinjuryRisk != null
              ? `${Math.round(row.reinjuryRisk * 100)}%${
                  row.isHighReinjuryRisk ? " · elevated" : ""
                }`
              : "—"}
          </div>
        </div>
        {row.recentHistory.length > 0 ? (
          <div className="sm:col-span-2">
            <div className="text-faint">Recent history</div>
            <ul className="mt-1 space-y-0.5 text-soft">
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
    let filtered = props.report.rows.filter((row) =>
      matchesFilter(row, filter),
    );
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
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
            className={`inline-flex min-h-11 items-center rounded-full border px-3 text-xs touch-manipulation ${focusRingClass} ${
              filter === entry.id
                ? "border-team-ink bg-team/15 text-ink"
                : "border-line-strong bg-surface-raised text-muted hover:border-faint"
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
        aria-label="Search injuries"
        className={`min-h-11 w-full rounded-lg border border-line bg-surface-base px-3 text-sm text-ink placeholder:text-disabled ${focusRingClass}`}
      />

      <section>
        <SectionHeading title="Current injuries" className="mb-3" />
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
        <section className="rounded-xl border border-line bg-surface-base/40 p-4">
          <SectionHeading title="Recent injury history" className="mb-3" />
          <ul className="space-y-1 text-sm text-muted">
            {props.report.historyRows.slice(0, 12).map((entry, index) => (
              <li key={`${entry.injuredOn}-${entry.type}-${index}`}>
                {formatGameDate(entry.injuredOn)}: {entry.type} (
                {entry.bodyPart}) · {entry.severity}
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
