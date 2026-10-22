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

/** DOM id of a post in the feed, for "Open post" links (`#post-…`). */
export function postAnchorId(postId: string): string {
  return `post-${postId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/** Points that make a single-game performance a big moment. */
const BIG_MOMENT_POINTS = 50;

/** Champion posts and 50-point games get a slightly larger card. */
export function isBigMoment(post: TimelinePostView): boolean {
  const a = post.attachment;
  if (a.type === "playoff") return a.event === "champion";
  if (a.type === "performance") return a.line.points >= BIG_MOMENT_POINTS;
  return false;
}

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
  const bigMoment = !compact && isBigMoment(post);
  return (
    <article
      // Compact copies (dashboard, showcase) repeat feed posts; only the
      // full post is the link target.
      id={compact ? undefined : postAnchorId(post.id)}
      aria-labelledby={nameId}
      // Styled in atmosphere.css: the fade runs once on mount and only when
      // motion is allowed; big moments get a slightly larger card.
      data-new-post={!compact && post.unread ? "" : undefined}
      data-big-moment={bigMoment ? "" : undefined}
      className={cn(
        "flex gap-3 border-b border-zinc-800 last:border-b-0",
        compact ? "py-3" : bigMoment ? "py-5" : "py-4",
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
        <p
          className={cn(
            "text-zinc-100",
            bigMoment ? "text-lg font-medium" : "text-base",
          )}
        >
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
