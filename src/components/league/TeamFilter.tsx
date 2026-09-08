"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn, focusRingClass } from "@/components/ui/styles";

export type TeamFilterOption = {
  teamId: string;
  label: string;
  abbreviation: string;
};

export type TeamFilterValue = "all" | "my" | string;

/**
 * Shared All / My Team / searchable team picker for Schedule + Transactions.
 */
export function TeamFilter(props: {
  teams: TeamFilterOption[];
  myTeamId: string;
  value: TeamFilterValue;
  /** Search param key (default "team"). */
  paramKey?: string;
}) {
  const paramKey = props.paramKey ?? "team";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return props.teams.slice(0, 12);
    }
    return props.teams
      .filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.abbreviation.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [props.teams, query]);

  function setTeam(next: TeamFilterValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete(paramKey);
    } else {
      params.set(paramKey, next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
    setQuery("");
  }

  const activeLabel =
    props.value === "all"
      ? "All Teams"
      : props.value === "my"
        ? "My Team"
        : (props.teams.find((t) => t.teamId === props.value)?.abbreviation ??
          "Team");

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTeam("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            props.value === "all"
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
            focusRingClass,
          )}
        >
          All Teams
        </button>
        <button
          type="button"
          onClick={() => setTeam("my")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            props.value === "my"
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
            focusRingClass,
          )}
        >
          My Team
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            props.value !== "all" && props.value !== "my"
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
            focusRingClass,
          )}
        >
          {activeLabel === "All Teams" || activeLabel === "My Team"
            ? "Team ▾"
            : `${activeLabel} ▾`}
        </button>
      </div>
      {open ? (
        <div className="absolute z-20 mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-950 p-2 shadow-xl">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams…"
            className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600"
            autoFocus
          />
          <ul className="max-h-48 overflow-y-auto">
            {filtered.map((team) => (
              <li key={team.teamId}>
                <button
                  type="button"
                  onClick={() => setTeam(team.teamId)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800",
                    focusRingClass,
                  )}
                >
                  <span>{team.label}</span>
                  <span className="font-mono text-xs text-zinc-500">
                    {team.abbreviation}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-xs text-zinc-500">No matches</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function parseTeamFilterParam(
  value: string | undefined,
  myTeamId: string,
): TeamFilterValue {
  if (!value || value === "all") {
    return "all";
  }
  if (value === "my" || value === myTeamId) {
    return value === myTeamId ? myTeamId : "my";
  }
  return value;
}

export function resolveTeamFilterId(
  value: TeamFilterValue,
  myTeamId: string,
): string | null {
  if (value === "all") {
    return null;
  }
  if (value === "my") {
    return myTeamId;
  }
  return value;
}
