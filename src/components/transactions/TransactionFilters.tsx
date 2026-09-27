"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  customDateRangeError,
  toTransactionHubSearchParams,
  type TransactionActivityMode,
  type TransactionDateRangeKey,
  type TransactionFilterGroup,
  type TransactionSortKey,
} from "@/state/transaction-hub-selectors";
import { addCalendarDays } from "@/domain/calendar-date";
import {
  TeamFilter,
  type TeamFilterOption,
  type TeamFilterValue,
} from "@/components/league/TeamFilter";
import { cn, focusRingClass } from "@/components/ui/styles";

const TYPE_OPTIONS: Array<{
  id: TransactionFilterGroup;
  label: string;
  disabled?: boolean;
}> = [
  { id: "all", label: "All" },
  { id: "trades", label: "Trades" },
  { id: "signings", label: "Signings" },
  { id: "releases", label: "Releases" },
  { id: "waivers", label: "Waivers (coming soon)", disabled: true },
  { id: "extensions", label: "Extensions (coming soon)", disabled: true },
  { id: "draft", label: "Draft" },
  { id: "other", label: "Other" },
];

const DATE_OPTIONS: Array<{ id: TransactionDateRangeKey; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "season", label: "Season" },
  { id: "custom", label: "Custom" },
];

const SORT_OPTIONS: Array<{ id: TransactionSortKey; label: string }> = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "team", label: "Team" },
  { id: "player", label: "Player" },
  { id: "type", label: "Transaction Type" },
  { id: "contract", label: "Contract Value" },
];

const selectClass = cn(
  "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100",
  focusRingClass,
);

export function TransactionFilters(props: {
  saveId: string;
  basePath: string;
  group: TransactionFilterGroup;
  range: TransactionDateRangeKey;
  teamValue: TeamFilterValue;
  search: string;
  teams: TeamFilterOption[];
  myTeamId: string;
  limit: number;
  sort: TransactionSortKey;
  activityMode: TransactionActivityMode;
  start?: string;
  end?: string;
  today: string;
}) {
  const router = useRouter();

  function href(overrides: Record<string, string | undefined>): string {
    const next = {
      type: props.group === "all" ? undefined : props.group,
      range: props.range === "season" ? undefined : props.range,
      team: props.teamValue === "all" ? undefined : String(props.teamValue),
      q: props.search || undefined,
      sort: props.sort === "newest" ? undefined : props.sort,
      activity:
        props.activityMode === "league" ? undefined : props.activityMode,
      start: props.range === "custom" ? props.start : undefined,
      end: props.range === "custom" ? props.end : undefined,
      limit: props.limit > 25 ? String(props.limit) : undefined,
      ...overrides,
    };
    const range =
      (next.range as TransactionDateRangeKey | undefined) ?? "season";
    const params = toTransactionHubSearchParams({
      group: (next.type as TransactionFilterGroup | undefined) ?? "all",
      teamParam: next.team,
      range,
      start: range === "custom" ? next.start : undefined,
      end: range === "custom" ? next.end : undefined,
      sort: (next.sort as TransactionSortKey | undefined) ?? "newest",
      activityMode:
        (next.activity as TransactionActivityMode | undefined) ?? "league",
      search: next.q ?? "",
      limit: next.limit ? Number(next.limit) : undefined,
    });
    const qs = params.toString();
    return qs ? `${props.basePath}?${qs}` : props.basePath;
  }

  function push(overrides: Record<string, string | undefined>) {
    router.push(href({ ...overrides, limit: undefined }));
  }

  const dateError =
    props.range === "custom"
      ? customDateRangeError(props.start, props.end)
      : null;
  const filtersActive =
    props.group !== "all" ||
    props.range !== "season" ||
    props.teamValue !== "all" ||
    props.search !== "" ||
    props.sort !== "newest" ||
    props.activityMode !== "league" ||
    Boolean(props.start) ||
    Boolean(props.end);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Activity">
        <Link
          href={href({ activity: undefined, limit: undefined })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em]",
            props.activityMode === "league"
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
            focusRingClass,
          )}
        >
          League Activity
        </Link>
        <Link
          href={href({ activity: "myTeam", limit: undefined })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em]",
            props.activityMode === "myTeam"
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
            focusRingClass,
          )}
        >
          My Team
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
          Transaction Type
          <select
            aria-label="Transaction Type"
            value={props.group}
            onChange={(event) =>
              push({
                type:
                  event.target.value === "all" ? undefined : event.target.value,
              })
            }
            className={selectClass}
          >
            {TYPE_OPTIONS.map((option) => (
              <option
                key={option.id}
                value={option.id}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div
          className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-500"
          aria-label="Team"
        >
          <span>Team</span>
          <TeamFilter
            teams={props.teams}
            myTeamId={props.myTeamId}
            value={props.teamValue}
            paramsToDelete={["limit"]}
          />
        </div>

        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
          Time
          <select
            aria-label="Time"
            value={props.range}
            onChange={(event) => {
              const next = event.target.value as TransactionDateRangeKey;
              if (next === "custom") {
                push({
                  range: "custom",
                  start: props.start ?? addCalendarDays(props.today, -29),
                  end: props.end ?? props.today,
                });
                return;
              }
              push({
                range: next === "season" ? undefined : next,
                start: undefined,
                end: undefined,
              });
            }}
            className={selectClass}
          >
            {DATE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
          Sort By
          <select
            aria-label="Sort By"
            value={props.sort}
            onChange={(event) =>
              push({
                sort:
                  event.target.value === "newest"
                    ? undefined
                    : event.target.value,
              })
            }
            className={selectClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {props.range === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
            Start
            <input
              type="date"
              aria-label="Start"
              value={props.start ?? ""}
              onChange={(event) =>
                push({
                  range: "custom",
                  start: event.target.value || undefined,
                  end: props.end,
                })
              }
              className={selectClass}
            />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
            End
            <input
              type="date"
              aria-label="End"
              value={props.end ?? ""}
              onChange={(event) =>
                push({
                  range: "custom",
                  start: props.start,
                  end: event.target.value || undefined,
                })
              }
              className={selectClass}
            />
          </label>
          {dateError ? (
            <p className="text-xs text-rose-300" role="alert">
              {dateError}
            </p>
          ) : null}
        </div>
      ) : null}

      <form
        method="get"
        action={props.basePath}
        className="flex flex-wrap gap-2"
      >
        {props.group !== "all" ? (
          <input type="hidden" name="type" value={props.group} />
        ) : null}
        {props.range !== "season" ? (
          <input type="hidden" name="range" value={props.range} />
        ) : null}
        {props.range === "custom" && props.start ? (
          <input type="hidden" name="start" value={props.start} />
        ) : null}
        {props.range === "custom" && props.end ? (
          <input type="hidden" name="end" value={props.end} />
        ) : null}
        {props.teamValue !== "all" ? (
          <input type="hidden" name="team" value={String(props.teamValue)} />
        ) : null}
        {props.sort !== "newest" ? (
          <input type="hidden" name="sort" value={props.sort} />
        ) : null}
        {props.activityMode !== "league" ? (
          <input type="hidden" name="activity" value={props.activityMode} />
        ) : null}
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
          Search
          <input
            id="transaction-search"
            type="search"
            name="q"
            defaultValue={props.search}
            placeholder="Search players…"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
        <button
          type="submit"
          className={cn(
            "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600",
            focusRingClass,
          )}
        >
          Search
        </button>
        {filtersActive ? (
          <Link
            href={props.basePath}
            className={cn(
              "inline-flex items-center text-sm text-amber-400 hover:text-amber-300",
              focusRingClass,
            )}
          >
            Clear filters
          </Link>
        ) : null}
      </form>
    </div>
  );
}
