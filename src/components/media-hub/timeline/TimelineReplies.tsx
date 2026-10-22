import { cn, focusRingClass } from "@/components/ui/styles";
import type { ComposedReply } from "@/state/media-timeline/compose-replies";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import { AccountAvatar } from "./AccountAvatar";

export function TimelineReplies(props: {
  replies: readonly ComposedReply[];
  context: TimelineDisplayContext;
}) {
  const count = props.replies.length;
  if (count === 0) return null;
  return (
    <details>
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center rounded-md text-sm text-zinc-400 touch-manipulation hover:text-zinc-200 [&::-webkit-details-marker]:hidden",
          focusRingClass,
        )}
      >
        {count === 1 ? "Show 1 reply" : `Show ${count} replies`}
      </summary>
      <ul className="ml-1 space-y-3 border-l border-zinc-800 py-1 pl-3">
        {props.replies.map((reply) => (
          <li key={reply.id} className="flex gap-2">
            <AccountAvatar
              account={reply.author}
              context={props.context}
              size="reply"
            />
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-semibold text-zinc-100">
                  {reply.author.displayName}
                </span>{" "}
                <span className="text-zinc-400">{reply.author.handle}</span>
              </p>
              <p className="text-sm text-zinc-200">{reply.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
