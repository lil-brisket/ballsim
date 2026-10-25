import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";
import { AwardAttachmentCard } from "./AwardAttachmentCard";
import { AwardRaceAttachmentCard } from "./AwardRaceAttachmentCard";
import { GameAttachmentCard } from "./GameAttachmentCard";
import { InjuryAttachmentCard } from "./InjuryAttachmentCard";
import { LeagueAttachmentCard } from "./LeagueAttachmentCard";
import { PerformanceAttachmentCard } from "./PerformanceAttachmentCard";
import { PlayoffAttachmentCard } from "./PlayoffAttachmentCard";
import { SigningAttachmentCard } from "./SigningAttachmentCard";
import { StreakAttachmentCard } from "./StreakAttachmentCard";
import { TimelinePostShell } from "./TimelinePostShell";
import { TradeAttachmentCard } from "./TradeAttachmentCard";

/** The attachment surface for a post, or null when the text says it all. */
export function TimelineAttachmentCard(props: {
  post: TimelinePostView;
  context: TimelineDisplayContext;
}) {
  const { post, context } = props;
  const attachment = post.attachment;
  switch (attachment.type) {
    case "game":
      return (
        <GameAttachmentCard
          attachment={attachment}
          context={context}
          boxScoreHref={post.boxScoreHref}
        />
      );
    case "performance":
      return (
        <PerformanceAttachmentCard attachment={attachment} context={context} />
      );
    case "award":
      return <AwardAttachmentCard attachment={attachment} context={context} />;
    case "award_race":
      return (
        <AwardRaceAttachmentCard attachment={attachment} context={context} />
      );
    case "playoff":
      return (
        <PlayoffAttachmentCard attachment={attachment} context={context} />
      );
    case "streak":
      return <StreakAttachmentCard attachment={attachment} context={context} />;
    case "trade":
      return <TradeAttachmentCard attachment={attachment} context={context} />;
    case "signing":
      return (
        <SigningAttachmentCard attachment={attachment} context={context} />
      );
    case "injury":
      return <InjuryAttachmentCard attachment={attachment} context={context} />;
    case "league":
      // Say each fact once: league copy is usually built from the summary.
      return post.text.includes(attachment.summary) ? null : (
        <LeagueAttachmentCard attachment={attachment} />
      );
  }
}

export function TimelinePost(props: {
  post: TimelinePostView;
  context: TimelineDisplayContext;
  compact?: boolean;
}) {
  const { post, context, compact } = props;
  return (
    <TimelinePostShell post={post} context={context} compact={compact}>
      {compact ? null : (
        <TimelineAttachmentCard post={post} context={context} />
      )}
    </TimelinePostShell>
  );
}
