import Link from "next/link";
import { EmptyState } from "@/components/ui";
import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";

const LINK_CLASS = cn(
  touchTargetTextClass,
  "text-sm text-amber-400 hover:text-amber-300",
  focusRingClass,
);

export function WatchGameUnavailable(props: {
  saveId: string;
  gameId: string;
}) {
  return (
    <EmptyState
      title="Play-by-play not recorded"
      message="Only your team's games from this season are recorded for replay. This game has no play-by-play log, so there is nothing to watch."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={`/dashboard/${props.saveId}/games/${props.gameId}`}
            className={LINK_CLASS}
          >
            ← Box score
          </Link>
          <Link
            href={`/dashboard/${props.saveId}/schedule`}
            className={LINK_CLASS}
          >
            Schedule
          </Link>
        </div>
      }
    />
  );
}
