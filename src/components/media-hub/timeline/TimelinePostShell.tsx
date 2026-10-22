import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui/styles";
import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";
import { AccountAvatar } from "./AccountAvatar";
import { TimelineEngagement } from "./TimelineEngagement";
import { PostText } from "./post-text";
import { TimelineReplies } from "./TimelineReplies";
import { UnreadDot } from "./UnreadDot";
import { VerifiedMark } from "./VerifiedMark";

export function TimelinePostShell(props: {
  post: TimelinePostView;
  context: TimelineDisplayContext;
  /** The attachment card, rendered by the caller. */
  children?: ReactNode;
  compact?: boolean;
}) {
  const { post, context, compact = false } = props;
  // useId: the same post can render twice on a page (top story + feed).
  const nameId = useId();
  return (
    <article
      aria-labelledby={nameId}
      className={cn(
        "flex gap-3 border-b border-zinc-800 last:border-b-0",
        compact ? "py-3" : "py-4",
      )}
    >
      <AccountAvatar
        account={post.author}
        context={context}
        size={compact ? "reply" : "post"}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <header className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <span id={nameId} className="font-bold text-zinc-50">
            {post.author.displayName}
          </span>
          {post.author.verified ? <VerifiedMark /> : null}
          <span className="text-zinc-400">{post.author.handle}</span>
          <span aria-hidden="true" className="text-zinc-400">
            ·
          </span>
          <time
            dateTime={post.occurredOn}
            title={post.dateLabel}
            className="text-xs text-zinc-400"
          >
            {post.relativeLabel}
          </time>
          {post.unread ? <UnreadDot /> : null}
        </header>
        <p className="text-sm text-zinc-100">
          <PostText text={post.text} tags={post.tags} saveId={context.saveId} />
        </p>
        {props.children}
        <TimelineEngagement
          display={post.engagementDisplay}
          label={post.engagementLabel}
        />
        <TimelineReplies replies={post.replies} context={context} />
      </div>
    </article>
  );
}
