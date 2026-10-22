import Link from "next/link";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import { cn, focusRingClass } from "@/components/ui/styles";
import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";
import { AccountAvatar } from "../timeline/AccountAvatar";
import { postAnchorId } from "../timeline/TimelinePostShell";
import { heroHeadline, postHeroGraphic } from "../timeline/TopStoryHero";

/**
 * One story slide: a full-bleed team backdrop with a single broadcast graphic,
 * a one-line caption and a link to the post. No engagement, replies or post
 * shell; the viewer overlays the progress bars and the close button.
 */
export function StorySlide(props: {
  post: TimelinePostView;
  context: TimelineDisplayContext;
  saveId: string;
}) {
  const { post, context, saveId } = props;
  const { branding, graphic, numbers } = postHeroGraphic(post, context);
  const { headline } = heroHeadline(post.text);

  return (
    <TeamThemeScope
      branding={branding}
      className="relative isolate flex h-full w-full flex-col overflow-hidden bg-surface-arena"
    >
      <div aria-hidden="true" className="media-hero-spotlight -z-10" />
      {branding ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-16 -z-10 h-80 w-80 opacity-10"
          data-story-watermark=""
        >
          <TeamLogoMark
            branding={branding}
            className="h-full w-full"
            decorative
          />
        </span>
      ) : null}

      <div className="flex items-center gap-2 px-4 pr-16 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.75rem))] text-sm text-zinc-300">
        <AccountAvatar account={post.author} context={context} size="reply" />
        <span className="min-w-0 truncate font-medium text-zinc-50">
          {post.author.displayName}
        </span>
        <span aria-hidden="true">·</span>
        <time
          dateTime={post.occurredOn}
          title={post.dateLabel}
          className="shrink-0 text-xs text-zinc-400"
        >
          {post.relativeLabel}
        </time>
      </div>

      <div
        data-story-graphic=""
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4 py-4"
      >
        {graphic}
        {numbers}
      </div>

      <div className="relative z-20 space-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="line-clamp-2 font-display text-xl font-bold leading-tight text-zinc-50">
          {headline}
        </p>
        <Link
          href={`/dashboard/${saveId}/media#${postAnchorId(post.id)}`}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border border-zinc-500 px-4 text-sm font-medium text-zinc-50 hover:border-zinc-300 touch-manipulation active:opacity-80",
            focusRingClass,
          )}
        >
          Open post
        </Link>
      </div>
    </TeamThemeScope>
  );
}
