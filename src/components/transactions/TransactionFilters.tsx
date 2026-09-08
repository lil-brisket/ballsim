import Link from "next/link";
import {
  type TransactionDateRangeKey,
  type TransactionFilterGroup,
} from "@/state/transaction-hub-selectors";
import {
  TeamFilter,
  type TeamFilterOption,
  type TeamFilterValue,
} from "@/components/league/TeamFilter";
import { cn, focusRingClass } from "@/components/ui/styles";

const TYPE_CHIPS: Array<{ id: TransactionFilterGroup; label: string }> = [
  { id: "all", label: "All" },
  { id: "trades", label: "Trades" },
  { id: "signings", label: "Signings" },
  { id: "releases", label: "Releases" },
  { id: "other", label: "Other" },
];

const DATE_CHIPS: Array<{ id: TransactionDateRangeKey; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "season", label: "Season" },
];

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
}) {
  function href(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const next = {
      type: props.group === "all" ? undefined : props.group,
      range: props.range === "season" ? undefined : props.range,
      team:
        props.teamValue === "all" ? undefined : String(props.teamValue),
      q: props.search || undefined,
      limit: props.limit > 25 ? String(props.limit) : undefined,
      ...overrides,
    };
    for (const [key, value] of Object.entries(next)) {
      if (value) {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return qs ? `${props.basePath}?${qs}` : props.basePath;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Transaction type">
        {TYPE_CHIPS.map((chip) => (
          <Link
            key={chip.id}
            href={href({
              type: chip.id === "all" ? undefined : chip.id,
              limit: undefined,
            })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              props.group === chip.id
                ? "border-amber-600 text-amber-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
              focusRingClass,
            )}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <TeamFilter
          teams={props.teams}
          myTeamId={props.myTeamId}
          value={props.teamValue}
        />
        <div className="flex flex-wrap gap-2" aria-label="Date range">
          {DATE_CHIPS.map((chip) => (
            <Link
              key={chip.id}
              href={href({
                range: chip.id === "season" ? undefined : chip.id,
                limit: undefined,
              })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                props.range === chip.id
                  ? "border-amber-600 text-amber-400"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
                focusRingClass,
              )}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>

      <form method="get" action={props.basePath} className="flex flex-wrap gap-2">
        {props.group !== "all" ? (
          <input type="hidden" name="type" value={props.group} />
        ) : null}
        {props.range !== "season" ? (
          <input type="hidden" name="range" value={props.range} />
        ) : null}
        {props.teamValue !== "all" ? (
          <input type="hidden" name="team" value={String(props.teamValue)} />
        ) : null}
        <input
          type="search"
          name="q"
          defaultValue={props.search}
          placeholder="Search players…"
          className="min-w-[12rem] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <button
          type="submit"
          className={cn(
            "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600",
            focusRingClass,
          )}
        >
          Search
        </button>
      </form>
    </div>
  );
}
