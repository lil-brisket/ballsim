"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { switchActiveOwnerTeamAction } from "@/application/actions";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { DashboardSnapshot } from "@/state/selectors";

type OwnedTeamSummary = DashboardSnapshot["ownedTeams"][number];

/** Flash / one-shot params that should not survive a franchise switch redirect. */
const TRANSIENT_RETURN_PATH_PARAMS = [
  "error",
  "simSummary",
  "daysAdvanced",
  "highlights",
  "fromDate",
] as const;

/**
 * Current owner-mode route for switchActiveOwnerTeamAction returnPath.
 * Preserves durable query state (calendar year/month/date, filters) and
 * drops transient flash params (error, sim summary).
 */
export function buildOwnerReturnPath(
  pathname: string,
  searchParams: URLSearchParams | { toString(): string },
): string {
  const params = new URLSearchParams(searchParams.toString());
  for (const key of TRANSIENT_RETURN_PATH_PARAMS) {
    params.delete(key);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function FranchiseMark(props: {
  team: OwnedTeamSummary;
  size: "sm" | "md";
}) {
  const { team, size } = props;
  const box = size === "md" ? "h-9 w-9" : "h-8 w-8";
  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-700`}
      style={{ backgroundColor: team.branding.primaryColor }}
    >
      <TeamLogoMark
        branding={team.branding}
        size="sm"
        title={`${team.city} ${team.name}`}
      />
    </span>
  );
}

function ActiveFranchiseLabel(props: {
  active: OwnedTeamSummary;
  canSwitchTeams: boolean;
}) {
  const { active, canSwitchTeams } = props;
  return (
    <>
      <FranchiseMark team={active} size="md" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-zinc-100">
          {active.city} {active.name}
        </span>
        <span className="block text-xs text-zinc-500">
          {active.wins}-{active.losses}
          {canSwitchTeams ? " · Switch franchise" : ""}
        </span>
      </span>
    </>
  );
}

const displayClassName =
  "flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-left";

const interactiveClassName = `${displayClassName} hover:border-amber-600/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500`;

export function OwnerTeamSwitcher(props: {
  saveId: string;
  ownedTeams: readonly OwnedTeamSummary[];
}) {
  const { saveId, ownedTeams } = props;
  const active = ownedTeams.find((team) => team.isActive) ?? ownedTeams[0];
  const canSwitchTeams = ownedTeams.length > 1;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!active) {
    return null;
  }

  if (!canSwitchTeams) {
    return (
      <div
        className={displayClassName}
        aria-label={`${active.city} ${active.name}`}
      >
        <ActiveFranchiseLabel active={active} canSwitchTeams={false} />
      </div>
    );
  }

  function selectTeam(teamId: string) {
    if (teamId === active!.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("saveId", saveId);
      formData.set("teamId", teamId);
      formData.set(
        "returnPath",
        buildOwnerReturnPath(pathname, searchParams),
      );
      await switchActiveOwnerTeamAction(formData);
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${active.city} ${active.name}, switch franchise`}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className={interactiveClassName}
      >
        <ActiveFranchiseLabel active={active} canSwitchTeams />
        <span className="ml-1 text-zinc-500" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Owned franchises"
          className="absolute left-0 z-30 mt-2 w-80 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-xl"
        >
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            My Franchises
          </p>
          <ul className="space-y-1">
            {ownedTeams.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={team.isActive}
                  onClick={() => selectTeam(team.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  <FranchiseMark team={team} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">
                      <span aria-hidden>{team.isActive ? "● " : "○ "}</span>
                      {team.city} {team.name}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {team.wins}-{team.losses}
                      {team.blockingDecisionCount > 0
                        ? ` · ⚠ ${team.blockingDecisionCount}`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
