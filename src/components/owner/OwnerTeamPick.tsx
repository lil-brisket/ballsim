"use client";

import { useState } from "react";
import { selectTeamAction } from "@/application/actions";
import {
  OWNER_PHILOSOPHIES,
  type OwnerPhilosophy,
} from "@/domain/entities/owner-philosophy";

const PHILOSOPHY_LABELS: Record<OwnerPhilosophy, string> = {
  win_now: "Win Now",
  build_for_the_future: "Build for the Future",
  financially_conservative: "Financially Conservative",
  market_expansion: "Market Expansion",
  balanced: "Balanced",
};

const PHILOSOPHY_BLURBS: Record<OwnerPhilosophy, string> = {
  win_now: "Prioritize wins, playoffs, and championships. Higher payroll tolerance.",
  build_for_the_future:
    "Prioritize youth development and long-term contention. More patience for losing seasons.",
  financially_conservative:
    "Prioritize profitability, cash, and payroll discipline.",
  market_expansion:
    "Prioritize attendance, fan sentiment, awareness, and reputation.",
  balanced:
    "Compete while staying solvent — moderate wins, payroll control, and franchise growth.",
};

export type TeamPickEntry = {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  conferenceName: string;
  divisionName: string;
};

export function OwnerTeamPick(props: {
  saveId: string;
  teams: readonly TeamPickEntry[];
}) {
  const [philosophy, setPhilosophy] = useState<OwnerPhilosophy>("balanced");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-4">
        <label
          htmlFor="ownerPhilosophy"
          className="block font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500"
        >
          Owner philosophy
        </label>
        <select
          id="ownerPhilosophy"
          name="ownerPhilosophy"
          value={philosophy}
          onChange={(event) =>
            setPhilosophy(event.target.value as OwnerPhilosophy)
          }
          className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {OWNER_PHILOSOPHIES.map((id) => (
            <option key={id} value={id}>
              {PHILOSOPHY_LABELS[id]}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-zinc-400">
          {PHILOSOPHY_BLURBS[philosophy]}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Locked with your franchise after the first time advance.
        </p>
      </div>

      <ul className="space-y-2">
        {props.teams.map((team) => (
          <li
            key={team.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
          >
            <div>
              <p className="font-medium text-zinc-100">
                {team.city} {team.name}{" "}
                <span className="font-mono text-xs text-zinc-500">
                  ({team.abbreviation})
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                {team.conferenceName} · {team.divisionName}
              </p>
            </div>
            <form action={selectTeamAction}>
              <input type="hidden" name="saveId" value={props.saveId} />
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="ownerPhilosophy" value={philosophy} />
              <button
                type="submit"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                Select
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
