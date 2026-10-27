"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { TeamFilterValue } from "./team-filter-utils";

export type { TeamFilterValue };

export type TeamFilterOption = {
  teamId: string;
  label: string;
  abbreviation: string;
};

/**
 * Shared All / My Team / searchable team picker for Schedule + Transactions.
 */
export function TeamFilter(props: {
  teams: TeamFilterOption[];
  myTeamId: string;
  value: TeamFilterValue;
  /** Search param key (default "team"). */
  paramKey?: string;
  /** Extra query keys to drop on change (e.g. pagination `limit`). */
  paramsToDelete?: string[];
}) {
  const paramKey = props.paramKey ?? "team";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    for (const key of props.paramsToDelete ?? []) {
      params.delete(key);
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
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTeam("all")}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm touch-manipulation",
            props.value === "all"
              ? "border-team-ink text-team-ink"
              : "border-line-strong text-muted hover:border-faint",
            focusRingClass,
          )}
        >
          All Teams
        </button>
        <button
          type="button"
          onClick={() => setTeam("my")}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm touch-manipulation",
            props.value === "my"
              ? "border-team-ink text-team-ink"
              : "border-line-strong text-muted hover:border-faint",
            focusRingClass,
          )}
        >
          My Team
        </button>
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm touch-manipulation",
            props.value !== "all" && props.value !== "my"
              ? "border-team-ink text-team-ink"
              : "border-line-strong text-muted hover:border-faint",
            focusRingClass,
          )}
        >
          {activeLabel === "All Teams" || activeLabel === "My Team"
            ? "Team ▾"
            : `${activeLabel} ▾`}
        </button>
      </div>
      {open ? (
        <div className="absolute z-20 mt-2 w-64 rounded-lg border border-line-strong bg-surface-base p-2 shadow-xl">
          <input
            type="search"
            aria-label="Search teams"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams…"
            className={cn(
              "mb-2 min-h-11 w-full rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink placeholder:text-disabled",
              focusRingClass,
            )}
            autoFocus
          />
          <ul className="max-h-48 overflow-y-auto">
            {filtered.map((team) => (
              <li key={team.teamId}>
                <button
                  type="button"
                  onClick={() => setTeam(team.teamId)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded px-2 text-left text-sm text-ink hover:bg-surface-high",
                    focusRingClass,
                  )}
                >
                  <span>{team.label}</span>
                  <span className="text-sm text-faint">
                    {team.abbreviation}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-faint">No matches</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
