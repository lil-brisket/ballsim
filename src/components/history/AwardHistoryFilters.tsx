"use client";

import { useRouter } from "next/navigation";
import { historyHubHref } from "@/components/history/history-hub-links";
import type { HistoryHubRoute } from "@/state/history-hub-selectors";

const SELECT_CLASS =
  "ml-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100";

export function AwardHistoryFilters(props: {
  saveId: string;
  route: HistoryHubRoute;
  currentSeasonYear: number;
  availableSeasons: number[];
  selectedSeason: string;
  awardFilter: string;
  awardOptions: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();

  const navigate = (season: string, award: string) => {
    router.push(
      historyHubHref(props.saveId, props.route, {
        tab: "awards",
        season,
        award,
      }),
    );
  };

  return (
    <div className="flex flex-wrap gap-3">
      <label className="text-sm text-zinc-400">
        Season
        <select
          className={SELECT_CLASS}
          value={props.selectedSeason}
          onChange={(event) => navigate(event.target.value, props.awardFilter)}
        >
          <option value="all">All seasons</option>
          {props.availableSeasons.map((year) => (
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
          className={SELECT_CLASS}
          value={props.awardFilter}
          onChange={(event) =>
            navigate(props.selectedSeason, event.target.value)
          }
        >
          <option value="">Season awards</option>
          {props.awardOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
