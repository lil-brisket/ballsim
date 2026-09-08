import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { cn, type Density } from "@/components/ui/styles";

/**
 * Compact roster list row. Prefer PlayerEntityLink for name clicks.
 */
export function RosterRow(props: {
  saveId: string;
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  age?: number;
  injuryStatus?: string;
  density?: Density;
  className?: string;
  canOpen?: boolean;
}) {
  const dense = props.density === "compact" || props.density == null;
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-zinc-800/80",
        dense ? "py-1.5" : "py-2.5",
        props.className,
      )}
    >
      <div className="min-w-0 flex-1">
        <PlayerEntityLink
          saveId={props.saveId}
          playerId={props.playerId}
          canOpen={props.canOpen}
          className="truncate text-sm text-amber-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {props.firstName} {props.lastName}
        </PlayerEntityLink>
        <p className="text-xs text-zinc-500">
          {props.position}
          {props.age != null ? ` · ${props.age}` : ""}
        </p>
      </div>
      <span className="shrink-0 font-mono text-sm text-zinc-200">
        {props.overall}
      </span>
      {props.injuryStatus ? (
        <InjuryBadge status={props.injuryStatus} />
      ) : null}
    </div>
  );
}
