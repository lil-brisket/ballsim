"use client";

import { Select } from "@/components/ui/Select";
import { useRouter } from "next/navigation";
import { historyHubHref } from "@/components/history/history-hub-links";
import type { HistoryHubRoute } from "@/state/history-hub-selectors";

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
      <label className="text-sm text-muted">
        Season
        <Select
          wrapperClassName="ml-2"
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
        </Select>
      </label>
      <label className="text-sm text-muted">
        Award
        <Select
          wrapperClassName="ml-2"
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
        </Select>
      </label>
    </div>
  );
}
