import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { StreakAttachment } from "@/state/media-timeline/types";
import { attachmentSurfaceClass, teamBrandingFor } from "./attachment-parts";

const LABEL: Record<StreakAttachment["event"], string> = {
  win_streak: "straight wins",
  losing_streak: "straight losses",
  streak_snapped: "game win streak snapped",
};

export function StreakAttachmentCard(props: {
  attachment: StreakAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: streak, context } = props;

  return (
    <div className={`${attachmentSurfaceClass} flex items-center gap-4`}>
      <TeamBadge
        branding={teamBrandingFor(context, streak.team)}
        name={streak.team.displayName}
        size="lg"
        decorative
      />
      <ScoreNumeral
        size="lg"
        tone={streak.event === "losing_streak" ? "loss" : "win"}
        value={streak.length}
      />
      <div className="min-w-0">
        <p className="text-zinc-50">{LABEL[streak.event]}</p>
        <p className="text-sm text-zinc-400">
          {streak.team.displayName}
          {streak.event === "streak_snapped" && streak.snappedBy
            ? `, snapped by ${streak.snappedBy.abbreviation}`
            : ""}
        </p>
      </div>
    </div>
  );
}
