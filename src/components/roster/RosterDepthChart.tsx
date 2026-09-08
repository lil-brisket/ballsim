import type { LineupView } from "@/state/team-management-selectors";
import type { PlayerPosition } from "@/domain/entities/player";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { EmptyState } from "@/components/owner/EmptyState";
import { cn, panelClass } from "@/components/ui/styles";

const POSITIONS: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"];

/**
 * Read-only depth chart from lineup slots (PG–C).
 * Combo roles shown via preferred/secondary on the player subtitle when present.
 */
export function RosterDepthChart(props: {
  saveId: string;
  lineup: LineupView;
}) {
  const starterBySlot = new Map(
    props.lineup.starters
      .filter((s) => s.slot)
      .map((s) => [s.slot as PlayerPosition, s]),
  );

  // Bench depth: first available players per primary position not already starting.
  const starterIds = new Set(props.lineup.starters.map((s) => s.playerId));
  const benchPool = [
    ...props.lineup.bench,
    ...props.lineup.inactive,
  ].filter((p) => !starterIds.has(p.playerId));

  function backupsFor(position: PlayerPosition) {
    return benchPool
      .filter((p) => p.position === position || p.slot === position)
      .slice(0, 2);
  }

  return (
    <div className="space-y-3">
      {POSITIONS.map((position) => {
        const starter = starterBySlot.get(position);
        const backups = backupsFor(position);
        return (
          <section
            key={position}
            className={cn(panelClass, "px-4 py-3")}
            aria-label={`${position} depth`}
          >
            <h3 className="font-mono text-sm font-medium text-amber-400">
              {position}
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2">
                <span className="w-16 shrink-0 font-mono text-[0.65rem] uppercase text-zinc-500">
                  Starter
                </span>
                {starter ? (
                  <span className="min-w-0 flex-1 truncate">
                    <PlayerEntityLink
                      saveId={props.saveId}
                      playerId={starter.playerId}
                    >
                      {starter.firstName} {starter.lastName}
                    </PlayerEntityLink>
                    {starter.position !== position ? (
                      <span className="ml-2 text-xs text-zinc-500">
                        ({starter.position})
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
                {starter ? (
                  <span className="font-mono text-xs text-zinc-400">
                    {starter.overall}
                  </span>
                ) : null}
              </li>
              {backups.length === 0 ? (
                <li className="flex items-center gap-2 text-zinc-600">
                  <span className="w-16 shrink-0 font-mono text-[0.65rem] uppercase text-zinc-600">
                    Backup
                  </span>
                  <span>—</span>
                </li>
              ) : (
                backups.map((player, index) => (
                  <li
                    key={player.playerId}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="w-16 shrink-0 font-mono text-[0.65rem] uppercase text-zinc-500">
                      {index === 0 ? "Backup" : "Reserve"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <PlayerEntityLink
                        saveId={props.saveId}
                        playerId={player.playerId}
                      >
                        {player.firstName} {player.lastName}
                      </PlayerEntityLink>
                      {player.position !== position ? (
                        <span className="ml-2 text-xs text-zinc-500">
                          ({player.position})
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-xs text-zinc-400">
                      {player.overall}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
      {props.lineup.starters.length === 0 ? (
        <EmptyState message="No lineup configured yet." />
      ) : null}
    </div>
  );
}
