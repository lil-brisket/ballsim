"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import type { AwardDefinitionId } from "@/domain/entities/awards";
import { AWARD_DEFINITIONS } from "@/systems/awards/award-definitions";
import type { AwardsHubRow } from "@/state/awards-hub-selectors";

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
  currentSeasonYear: number;
  seasons: number[];
  majorAwards: AwardsHubRow[];
  monthlyAwards: AwardsHubRow[];
  isBrowsingHistorical: boolean;
  selectedSeasonYear: number;
}) {
  const [seasonYear, setSeasonYear] = useState<string>(
    String(props.selectedSeasonYear),
  );
  const [awardId, setAwardId] = useState<string>("");

  const allRows = useMemo(
    () => [...props.majorAwards, ...props.monthlyAwards],
    [props.majorAwards, props.monthlyAwards],
  );

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      if (seasonYear && row.seasonYear !== Number(seasonYear)) {
        return false;
      }
      if (awardId && row.awardId !== awardId) {
        return false;
      }
      return true;
    });
  }, [allRows, seasonYear, awardId]);

  const major = filtered.filter((r) => r.cadence === "yearly");
  const monthly = filtered.filter((r) => r.cadence === "monthly");
  const browsingHistorical =
    seasonYear !== "" && Number(seasonYear) !== props.currentSeasonYear;

  return (
    <div className="space-y-4">
      {browsingHistorical ? (
        <p
          role="status"
          className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300"
        >
          Viewing {seasonYear} awards (historical — not the current season{" "}
          {props.currentSeasonYear}).
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-zinc-400">
          Season
          <select
            className="ml-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
            value={seasonYear}
            onChange={(event) => setSeasonYear(event.target.value)}
          >
            {props.seasons.map((year) => (
              <option key={year} value={String(year)}>
                {year}
                {year === props.currentSeasonYear ? " (current)" : ""}
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

      <AwardTable
        title="Major awards"
        saveId={props.saveId}
        rows={major}
        empty="No major awards for this season."
      />
      <AwardTable
        title="Monthly awards"
        saveId={props.saveId}
        rows={monthly}
        empty="No monthly awards for this season."
      />
    </div>
  );
}

function AwardTable(props: {
  title: string;
  saveId: string;
  rows: AwardsHubRow[];
  empty: string;
}) {
  return (
    <Section title={props.title}>
      {props.rows.length === 0 ? (
        <EmptyState message={props.empty} />
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
              {props.rows.map((row) => (
                <tr key={row.result.id} className="border-b border-zinc-900/80">
                  <td className="px-3 py-2 font-mono text-amber-400">
                    {row.result.period
                      ? row.result.period
                      : String(row.seasonYear)}
                  </td>
                  <td className="px-3 py-2 text-zinc-100">{row.displayName}</td>
                  <td className="px-3 py-2">
                    {row.winnerSubjectType === "player" ? (
                      <PlayerEntityLink
                        saveId={props.saveId}
                        playerId={row.winnerSubjectId}
                      >
                        {row.winnerName}
                      </PlayerEntityLink>
                    ) : (
                      <span className="text-zinc-100">{row.winnerName}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {row.winnerTeamId && row.teamName ? (
                      <TeamEntityLink
                        saveId={props.saveId}
                        teamId={row.winnerTeamId}
                      >
                        {row.teamName}
                      </TeamEntityLink>
                    ) : (
                      (row.teamName ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {row.finalists.length === 0
                      ? "—"
                      : row.finalists.map((f) => f.name).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
