"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RosterPlayerView } from "@/state/selectors";
import type { LineupView } from "@/state/team-management-selectors";
import { PlayerCard } from "@/components/basketball/PlayerCard";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { RosterTable } from "@/components/game/RosterTable";
import { RosterDepthChart } from "@/components/roster/RosterDepthChart";
import { cn, focusRingClass } from "@/components/ui/styles";

export type RosterViewMode = "table" | "cards" | "depth";

const MODES: { id: RosterViewMode; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "cards", label: "Cards" },
  { id: "depth", label: "Depth Chart" },
];

export function RosterViewSwitcher(props: {
  saveId: string;
  players: RosterPlayerView[];
  lineup: LineupView;
  view: RosterViewMode;
}) {
  const router = useRouter();
  const view = props.view;

  function setView(next: RosterViewMode) {
    const params = new URLSearchParams();
    if (next !== "table") {
      params.set("view", next);
    }
    const qs = params.toString();
    router.replace(
      `/dashboard/${props.saveId}/roster${qs ? `?${qs}` : ""}`,
      { scroll: false },
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Roster view mode"
      >
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={view === mode.id}
            onClick={() => setView(mode.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              focusRingClass,
              view === mode.id
                ? "bg-amber-600/20 text-amber-300"
                : "border border-zinc-700 text-zinc-400 hover:border-zinc-500",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {view === "table" ? (
        <RosterTable saveId={props.saveId} players={props.players} />
      ) : null}

      {view === "cards" ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {props.players.map((player) => (
            <li key={player.playerId}>
              <PlayerEntityLink
                saveId={props.saveId}
                playerId={player.playerId}
                className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                <PlayerCard
                  firstName={player.firstName}
                  lastName={player.lastName}
                  position={player.position}
                  overall={player.overall}
                  age={player.age}
                  injuryStatus={
                    player.injuryKind !== "available"
                      ? player.injuryKind
                      : null
                  }
                  contractLabel={
                    player.contractSalary != null
                      ? `$${(player.contractSalary / 1_000_000).toFixed(1)}M`
                      : null
                  }
                  fields={{
                    position: true,
                    overall: true,
                    age: true,
                    team: false,
                    role: false,
                    contract: true,
                    injury: true,
                  }}
                />
              </PlayerEntityLink>
            </li>
          ))}
        </ul>
      ) : null}

      {view === "depth" ? (
        <RosterDepthChart saveId={props.saveId} lineup={props.lineup} />
      ) : null}

      {view !== "table" ? (
        <p className="text-xs text-zinc-600">
          Tip: use Table view for sorting and filtering.{" "}
          <Link
            href={`/dashboard/${props.saveId}/team-management/lineups`}
            className="text-amber-400 hover:text-amber-300"
          >
            Edit lineups
          </Link>
        </p>
      ) : null}
    </div>
  );
}
