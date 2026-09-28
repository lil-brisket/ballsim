import { notFound } from "next/navigation";
import { markAllMediaReadAction } from "@/application/actions";
import { loadMediaPageView } from "@/application/game-service";
import { FranchiseMediaAttention } from "@/components/media-hub/FranchiseMediaAttention";
import { MediaFeed } from "@/components/media-hub/MediaFeed";
import { MediaOverview } from "@/components/media-hub/MediaOverview";
import { MediaTabNav } from "@/components/media-hub/MediaTabNav";
import { MediaUnreadBadge } from "@/components/media-hub/MediaUnreadBadge";
import { SocialFeed } from "@/components/media-hub/SocialFeed";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type MediaPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    tab?: string;
    filter?: string;
  }>;
};

/**
 * League Media Hub — narrative stories, featured hierarchy, social reactions.
 */
export default async function MediaPage({
  params,
  searchParams,
}: MediaPageProps) {
  const { saveId } = await params;
  const { error, tab, filter } = await searchParams;
  const view = await loadMediaPageView(saveId, { tab, filter });
  if (!view) {
    notFound();
  }

  const returnParams = new URLSearchParams();
  if (view.tab !== "latest") {
    returnParams.set("tab", view.tab);
  }
  if (view.tab === "latest" && view.latestFilter !== "all") {
    returnParams.set("filter", view.latestFilter);
  }
  const returnQs = returnParams.toString();
  const returnPath = returnQs
    ? `/dashboard/${saveId}/media?${returnQs}`
    : `/dashboard/${saveId}/media`;

  const feedItems = view.items.map((item) => ({
    ...item,
    saveId,
    returnPath,
    reactionCount: item.reactionCount,
  }));

  return (
    <>
      <PageHeader
        title="Media Hub"
        subtitle="The story of the league — narrative context around simulation events"
        actions={
          <form action={markAllMediaReadAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
            >
              Mark all read
              <MediaUnreadBadge count={view.unreadCount} />
            </button>
          </form>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <MediaOverview
        view={view}
        saveId={saveId}
        returnPath={returnPath}
        feedHref={`${returnPath}#your-feed`}
      />

      <div id="your-feed" className="min-w-0 scroll-mt-4">
        <Section title="Your Feed">
          <MediaTabNav
            saveId={saveId}
            activeTab={view.tab}
            latestFilter={view.latestFilter}
            unreadCount={view.unreadCount}
          />
          {view.tab === "social" ? (
            <SocialFeed
              posts={view.socialPosts}
              mediaHrefBase={`/dashboard/${saveId}/media`}
            />
          ) : (
            <MediaFeed
              featuredStoryId={view.featuredStoryId}
              items={feedItems}
            />
          )}
        </Section>
      </div>

      <FranchiseMediaAttention attention={view.franchiseAttention} />
    </>
  );
}
