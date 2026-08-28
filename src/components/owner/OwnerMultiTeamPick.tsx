"use client";

import { useMemo, useState } from "react";
import { confirmOwnedFranchisesAction } from "@/application/actions";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamListEntry } from "@/state/selectors";

/**
 * Optional multi-select for additional owned franchises during onboarding.
 * Primary franchise is already confirmed via city pick.
 */
export function OwnerMultiTeamPick(props: {
  saveId: string;
  primaryTeamId: string;
  teams: readonly TeamListEntry[];
}) {
  const available = useMemo(
    () => props.teams.filter((team) => team.id !== props.primaryTeamId),
    [props.teams, props.primaryTeamId],
  );
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(teamId: string) {
    setSelected((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-zinc-100">
          Control additional franchises?
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Optional. Each franchise remains an independent organization with its
          own owner identity, roster, and finances.
        </p>
      </div>

      <ul className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 p-2">
        {available.map((team) => {
          const checked = selected.includes(team.id);
          return (
            <li key={team.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-zinc-900">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(team.id)}
                  className="h-4 w-4 rounded border-zinc-600"
                />
                {team.branding ? (
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
                ) : null}
                <span className="min-w-0">
                  <span className="block text-sm text-zinc-100">
                    {team.city} {team.name}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {team.conferenceName} · {team.divisionName}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <form action={confirmOwnedFranchisesAction} className="flex flex-wrap gap-3">
        <input type="hidden" name="saveId" value={props.saveId} />
        {selected.map((teamId) => (
          <input
            key={teamId}
            type="hidden"
            name="additionalTeamId"
            value={teamId}
          />
        ))}
        <button
          type="submit"
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {selected.length === 0
            ? "Continue with one franchise"
            : `Continue with ${selected.length + 1} franchises`}
        </button>
      </form>
    </div>
  );
}
