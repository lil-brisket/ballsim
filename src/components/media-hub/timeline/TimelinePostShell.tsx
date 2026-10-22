import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui/styles";
import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";
import { TimelineAvatar } from "./TimelineAvatar";
import { TimelineEngagement } from "./TimelineEngagement";
import { TimelineReplies } from "./TimelineReplies";

function VerifiedMark() {
  return (
    <>
      <svg
        viewBox="0 0 24 24"
        width={16}
        height={16}
        aria-hidden="true"
        focusable={false}
        className="shrink-0 text-team-ink"
      >
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path
          d="M7.5 12.5l3 3 6-6.5"
          fill="none"
          stroke="var(--surface-arena)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">Verified</span>
    </>
  );
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
  return (
    <article
      aria-labelledby={nameId}
      className={cn(
        "flex gap-3 border-b border-zinc-800 last:border-b-0",
        compact ? "py-3" : "py-4",
      )}
    >
      <TimelineAvatar
        account={post.author}
        context={context}
        size={compact ? "sm" : "md"}
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
          {post.unread ? (
            <>
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-2 w-2 rounded-full bg-team"
              />
              <span className="sr-only">Unread</span>
            </>
          ) : null}
        </header>
        <p className="text-sm text-zinc-100">{post.text}</p>
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
