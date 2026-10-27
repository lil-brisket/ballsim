"use client";

import { Select } from "@/components/ui/Select";
import { buttonClass } from "@/components/ui/Button";
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
import { cn, focusRingClass, panelClass } from "@/components/ui/styles";

const TYPE_OPTIONS: Array<{
  id: TransactionFilterGroup;
  label: string;
  disabled?: boolean;
}> = [
  { id: "all", label: "All" },
  { id: "trades", label: "Trades" },
  { id: "signings", label: "Signings" },
  { id: "releases", label: "Releases" },
  { id: "waivers", label: "Waivers" },
  { id: "extensions", label: "Extensions" },
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
  "min-h-11 rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink",
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

  const fieldClass = "flex min-w-0 flex-col gap-1 text-sm text-muted";

  return (
    <div className={cn(panelClass, "space-y-4 p-4")}>
      <form
        method="get"
        action={props.basePath}
        className="flex flex-wrap items-center gap-2"
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
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Search</span>
          <input
            id="transaction-search"
            type="search"
            name="q"
            defaultValue={props.search}
            placeholder="Search players or teams…"
            className={cn(selectClass, "w-full placeholder:text-disabled")}
          />
        </label>
        <button type="submit" className={buttonClass({ variant: "secondary" })}>
          Search
        </button>
        {filtersActive ? (
          <Link
            href={props.basePath}
            className={cn(
              "inline-flex min-h-11 items-center px-1 text-sm text-team-ink underline-offset-4 hover:underline",
              focusRingClass,
            )}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div
          className={cn(fieldClass, "sm:col-span-2")}
          role="group"
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

        <label className={fieldClass}>
          Transaction Type
          <Select
            aria-label="Transaction Type"
            value={props.group}
            onChange={(event) =>
              push({
                type:
                  event.target.value === "all" ? undefined : event.target.value,
              })
            }
            wrapperClassName="w-full"
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
          </Select>
        </label>

        <label className={fieldClass}>
          Time
          <Select
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
            wrapperClassName="w-full"
          >
            {DATE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className={fieldClass}>
          Sort By
          <Select
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
            wrapperClassName="w-full"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {props.range === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm text-muted">
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
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm text-muted">
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
            <p className="text-sm text-loss" role="alert">
              {dateError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
