import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { cn } from "@/components/ui/styles";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { StreakAttachment } from "@/state/media-timeline/types";
import { teamBrandingFor } from "./attachment-parts";
import { TeamMark } from "./TeamMark";
import { TeamSurface } from "./TeamSurface";

const LABEL: Record<StreakAttachment["event"], string> = {
  win_streak: "straight wins",
  losing_streak: "straight losses",
  streak_snapped: "game win streak snapped",
};

const CHAIN_CAP = 10;

function Chain(props: { length: number; loss: boolean }) {
  const shown = Math.max(0, Math.min(props.length, CHAIN_CAP));
  const extra = props.length - shown;
  return (
    <div aria-hidden="true" className="mt-3 flex flex-wrap items-center gap-1">
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          data-chain-square={props.loss ? "L" : "W"}
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-zinc-950",
            props.loss ? "bg-loss" : "bg-win",
          )}
        >
          {props.loss ? "L" : "W"}
        </span>
      ))}
      {extra > 0 ? (
        <span className="ml-1 text-sm tabular-nums text-zinc-400">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

export function StreakAttachmentCard(props: {
  attachment: StreakAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: streak, context } = props;
  const branding = teamBrandingFor(context, streak.team);
  const loss = streak.event === "losing_streak";
  const snapper = streak.event === "streak_snapped" ? streak.snappedBy : null;

  return (
    <TeamSurface branding={branding} band="left">
      <div className="flex items-center gap-4">
        <TeamMark branding={branding} size="lg" />
        <ScoreNumeral
          size="lg"
          tone={loss ? "loss" : "win"}
          value={streak.length}
        />
        <div className="min-w-0">
          <p className="text-zinc-50">{LABEL[streak.event]}</p>
          <p className="text-sm text-zinc-400">{streak.team.displayName}</p>
        </div>
      </div>
      <Chain length={streak.length} loss={loss} />
      {snapper ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
          <TeamMark branding={teamBrandingFor(context, snapper)} size="sm" />
          <span>snapped by {snapper.abbreviation}</span>
        </p>
      ) : null}
    </TeamSurface>
  );
}
