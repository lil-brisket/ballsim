"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { switchActiveOwnerTeamAction } from "@/application/actions";
import { TeamBadge } from "@/components/ui/TeamBadge";
import type { DashboardSnapshot } from "@/state/selectors";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

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

function FranchiseMark(props: { team: OwnedTeamSummary; size: "sm" | "md" }) {
  const { team } = props;
  return (
    <TeamBadge
      branding={team.branding}
      name={`${team.city} ${team.name}`}
      size={props.size}
      decorative
    />
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
        <span className="block truncate font-display text-lg font-bold uppercase leading-tight tracking-wide text-zinc-50 sm:text-2xl">
          {active.city} {active.name}
        </span>
        {canSwitchTeams ? (
          <span className="block font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Switch franchise
          </span>
        ) : null}
      </span>
    </>
  );
}

const displayClassName =
  "flex min-h-11 min-w-0 max-w-full items-center gap-3 rounded-lg py-1 pr-2 text-left";

const interactiveClassName = cn(
  displayClassName,
  "touch-manipulation hover:bg-white/5 active:opacity-80",
  focusRingClass,
);

export function OwnerTeamSwitcher(props: {
  saveId: string;
  ownedTeams: readonly OwnedTeamSummary[];
  /** Local shared league: only list this participant's franchises. */
  activeParticipantId?: string | null;
}) {
  const { saveId, activeParticipantId } = props;
  const ownedTeams =
    activeParticipantId == null
      ? props.ownedTeams
      : props.ownedTeams.filter(
          (team) => team.participantId === activeParticipantId,
        );
  const active = ownedTeams.find((team) => team.isActive) ?? ownedTeams[0];
  const canSwitchTeams = ownedTeams.length > 1;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
      formData.set("returnPath", buildOwnerReturnPath(pathname, searchParams));
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
        <span className="ml-1 shrink-0 text-team-ink" aria-hidden>
          ▾
        </span>
      </button>

      {open
        ? createPortal(
            <button
              type="button"
              aria-label="Dismiss franchise list"
              className="fixed inset-0 z-[45] bg-black/40"
              onClick={() => setOpen(false)}
            />,
            document.body,
          )
        : null}

      {open ? (
        <div
          role="listbox"
          aria-label="Owned franchises"
          className="absolute left-0 z-[46] mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-surface-line bg-surface-arena p-2 shadow-arena"
        >
          <p className="px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-team-ink">
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
                  className={cn(
                    touchTargetClass,
                    "w-full justify-start gap-3 rounded-lg px-2 text-left hover:bg-white/5",
                    team.isActive && "nav-active",
                    focusRingClass,
                  )}
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
