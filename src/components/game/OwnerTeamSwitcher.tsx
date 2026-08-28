"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { switchActiveOwnerTeamAction } from "@/application/actions";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { DashboardSnapshot } from "@/state/selectors";

type OwnedTeamSummary = DashboardSnapshot["ownedTeams"][number];

export function OwnerTeamSwitcher(props: {
  saveId: string;
  ownedTeams: readonly OwnedTeamSummary[];
}) {
  const { saveId, ownedTeams } = props;
  const active = ownedTeams.find((team) => team.isActive) ?? ownedTeams[0];
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!active) {
    return null;
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
      await switchActiveOwnerTeamAction(formData);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-left hover:border-amber-600/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      >
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-700"
          style={{ backgroundColor: active.branding.primaryColor }}
        >
          <TeamLogoMark
            branding={active.branding}
            size="sm"
            title={`${active.city} ${active.name}`}
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-zinc-100">
            {active.city} {active.name}
          </span>
          <span className="block text-xs text-zinc-500">
            {active.wins}-{active.losses}
            {ownedTeams.length > 1 ? " · Switch team" : ""}
          </span>
        </span>
        {ownedTeams.length > 1 ? (
          <span className="ml-1 text-zinc-500" aria-hidden>
            ▼
          </span>
        ) : null}
      </button>

      {open && ownedTeams.length > 1 ? (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-2 w-80 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-xl"
        >
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            My Teams
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
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-700"
                    style={{ backgroundColor: team.branding.primaryColor }}
                  >
                    <TeamLogoMark
                      branding={team.branding}
                      size="sm"
                      title={`${team.city} ${team.name}`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">
                      {team.isActive ? "✓ " : ""}
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
