import Link from "next/link";
import { MediaStoryCard } from "@/components/media-hub/MediaStoryCard";
import { EmptyState } from "@/components/owner/EmptyState";
import { StatCard } from "@/components/owner/StatCard";
import {
  MEDIA_HUB_STORY_TYPE_ORDER,
  type MediaHubView,
} from "@/state/media-hub-selectors";
import type { MediaStoryType } from "@/domain/entities/media-item";

function recentActivityCaption(
  counts: Record<MediaStoryType, number>,
): string | null {
  const parts = MEDIA_HUB_STORY_TYPE_ORDER.filter(
    (storyType) => counts[storyType] > 0,
  ).map((storyType) => `${counts[storyType]} ${storyType}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function MediaOverview(props: {
  view: MediaHubView;
  saveId: string;
  returnPath: string;
  feedHref: string;
}) {
  const { view, saveId, returnPath, feedHref } = props;
  const featured = view.featuredStory;
  const caption = recentActivityCaption(view.storyTypeCounts);

  return (
    <section
      aria-label="Media overview"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      <div className="min-w-0 md:col-span-2">
        {featured ? (
          <MediaStoryCard
            {...featured}
            saveId={saveId}
            returnPath={returnPath}
            featured
          />
        ) : (
          <EmptyState message="No major story right now." />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <StatCard
          density="compact"
          label="Unread"
          value={
            <div className="space-y-1">
              <data value={view.unreadCount}>{view.unreadCount}</data>
              <div>
                <Link
                  href={feedHref}
                  className="text-sm font-normal text-amber-400 hover:underline"
                >
                  View feed
                </Link>
              </div>
            </div>
          }
        />
        <StatCard
          density="compact"
          label="Major stories"
          value={`${view.majorStoryCount} of ${view.totalStories}`}
        />
        <StatCard
          density="compact"
          label="Recent activity"
          value={
            <div className="space-y-1">
              <span>{view.recentStoryCount}</span>
              {caption ? (
                <p className="text-xs font-normal text-zinc-500">{caption}</p>
              ) : null}
            </div>
          }
        />
        <StatCard
          density="compact"
          label="Media attention"
          value={`${view.franchiseAttention.mediaAttention}`}
        />
      </div>
    </section>
  );
}
