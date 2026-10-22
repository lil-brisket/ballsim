import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markAllMediaReadAction } from "@/application/actions";
import { loadMediaPageView } from "@/application/game-service";
import {
  MediaFilterList,
  MediaFilterTabs,
  MediaScoresStrip,
  MediaSideRail,
} from "@/components/media-hub/MediaHubRails";
import { MediaStoriesStrip } from "@/components/media-hub/stories/MediaStoriesStrip";
import {
  TimelineDayDivider,
  TimelineFeed,
  TimelineLoadMore,
} from "@/components/media-hub/timeline/TimelineFeed";
import { TimelinePost } from "@/components/media-hub/timeline/TimelinePost";
import { TopStoryHero } from "@/components/media-hub/timeline/TopStoryHero";
import { buttonClass } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = { title: "Media Hub" };

type MediaPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    filter?: string;
    /** Pre-timeline links (`?tab=games`) map onto the new filters. */
    tab?: string;
    tag?: string;
    before?: string;
  }>;
};

/** League timeline: scores, standout games, awards, moves and injuries. */
export default async function MediaPage({
  params,
  searchParams,
}: MediaPageProps) {
  const { saveId } = await params;
  const { error, filter, tab, tag, before } = await searchParams;
  const view = await loadMediaPageView(saveId, { filter, tab, tag, before });
  if (!view) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Hub"
        actions={
          view.unreadCount > 0 ? (
            <form action={markAllMediaReadAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="returnPath" value={view.returnPath} />
              <button
                type="submit"
                className={buttonClass({ variant: "quiet" })}
              >
                Mark all read
              </button>
            </form>
          ) : null
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[12rem_minmax(0,40rem)_minmax(0,1fr)] xl:gap-8">
        <aside className="hidden xl:block">
          <div className="sticky top-4">
            <MediaFilterList filters={view.filters} />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <MediaStoriesStrip
            saveId={saveId}
            rings={view.stories.rings}
            context={view.stories.context}
          />
          {view.topStory ? (
            <TopStoryHero post={view.topStory} context={view.context} />
          ) : null}

          <div className="space-y-4 xl:hidden">
            <MediaScoresStrip
              scores={view.scores}
              dateLabel={view.scoresDateLabel}
            />
            <MediaFilterTabs filters={view.filters} />
          </div>

          {view.tag ? (
            <SectionHeading
              as="h2"
              title={`#${view.tag.replace(/\s+/g, "")}`}
            />
          ) : null}

          {view.emptyMessage ? (
            <p className="py-6 text-sm text-zinc-400">{view.emptyMessage}</p>
          ) : (
            <TimelineFeed>
              {view.posts.flatMap((post, index) => {
                const previous = view.posts[index - 1];
                const node = (
                  <TimelinePost
                    key={post.id}
                    post={post}
                    context={view.context}
                  />
                );
                if (previous && previous.occurredOn === post.occurredOn) {
                  return [node];
                }
                return [
                  <TimelineDayDivider
                    key={`day-${post.occurredOn}-${post.id}`}
                    label={
                      post.relativeLabel === "Today" ? "Today" : post.dateLabel
                    }
                  />,
                  node,
                ];
              })}
            </TimelineFeed>
          )}

          <TimelineLoadMore href={view.loadMoreHref} />
        </div>

        <aside className="hidden xl:block" aria-label="Around the league">
          <MediaSideRail view={view} />
        </aside>
      </div>
    </div>
  );
}
