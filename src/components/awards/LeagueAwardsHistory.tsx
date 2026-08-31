"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import type { AwardDefinitionId } from "@/domain/entities/awards";
import { AWARD_DEFINITIONS } from "@/systems/awards/award-definitions";
import type { LeagueAwardRowView } from "@/state/award-selectors";

const AWARD_FILTER_OPTIONS: Array<{ id: "" | AwardDefinitionId; label: string }> =
  [
    { id: "", label: "All awards" },
    ...Object.values(AWARD_DEFINITIONS).map((def) => ({
      id: def.id,
      label: def.displayName,
    })),
  ];

export function LeagueAwardsHistory(props: {
  saveId: string;
  seasons: number[];
  rows: LeagueAwardRowView[];
}) {
  const [seasonYear, setSeasonYear] = useState<string>("");
  const [awardId, setAwardId] = useState<string>("");

  const filtered = useMemo(() => {
    return props.rows.filter((row) => {
      if (seasonYear && row.result.seasonYear !== Number(seasonYear)) {
        return false;
      }
      if (awardId && row.result.awardId !== awardId) {
        return false;
      }
      return true;
    });
  }, [props.rows, seasonYear, awardId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-zinc-400">
          Season
          <select
            className="ml-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
            value={seasonYear}
            onChange={(event) => setSeasonYear(event.target.value)}
          >
            <option value="">All seasons</option>
            {props.seasons.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-400">
          Award
          <select
            className="ml-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
            value={awardId}
            onChange={(event) => setAwardId(event.target.value)}
          >
            {AWARD_FILTER_OPTIONS.map((option) => (
              <option key={option.id || "all"} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Section title="Award history">
        {filtered.length === 0 ? (
          <EmptyState message="No awards recorded yet. Awards appear after completed regular-season months and seasons." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Season</th>
                  <th className="px-3 py-2 font-medium">Award</th>
                  <th className="px-3 py-2 font-medium">Winner</th>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">Finalists</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.result.id}
                    className="border-b border-zinc-900/80"
                  >
                    <td className="px-3 py-2 font-mono text-amber-400">
                      {row.result.period
                        ? `${row.result.period}`
                        : String(row.result.seasonYear)}
                    </td>
                    <td className="px-3 py-2 text-zinc-100">
                      {row.displayName}
                    </td>
                    <td className="px-3 py-2">
                      {row.winnerHref ? (
                        <Link
                          href={row.winnerHref}
                          className="text-amber-400 hover:underline"
                        >
                          {row.winnerName}
                        </Link>
                      ) : (
                        <span className="text-zinc-100">{row.winnerName}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {row.teamName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {row.finalists.length === 0
                        ? "—"
                        : row.finalists
                            .map((f) => f.name)
                            .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
