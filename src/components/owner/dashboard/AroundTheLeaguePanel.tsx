import Link from "next/link";
import { TimelinePost } from "@/components/media-hub/timeline/TimelinePost";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import type { TimelineHighlights } from "@/state/media-timeline/highlights";

/**
 * Around the League: the Media Hub's lead posts (top story first) in the
 * compact post shell. Used by the dashboard and the League hub.
 */
export function AroundTheLeaguePanel(props: {
  timeline: TimelineHighlights;
  saveId: string;
}) {
  const mediaHref = `/dashboard/${props.saveId}/media`;
  const { posts, context } = props.timeline;

  return (
    <Section
      title="Around the League"
      action={
        <Link
          href={mediaHref}
          className={cn(
            touchTargetTextClass,
            "text-sm text-team-ink hover:underline",
            focusRingClass,
          )}
        >
          Media Hub
        </Link>
      }
    >
      {posts.length === 0 ? (
        <ArenaPanel as="div" density="default">
          <EmptyState message="No league stories yet. Advance the season to fill the briefing." />
        </ArenaPanel>
      ) : (
        <ArenaPanel as="div" edge="left" density="compact" className="!py-0">
          {posts.map((post) => (
            <TimelinePost key={post.id} post={post} context={context} compact />
          ))}
        </ArenaPanel>
      )}
    </Section>
  );
}
