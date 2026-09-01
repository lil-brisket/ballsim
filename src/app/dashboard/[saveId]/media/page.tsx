import { notFound } from "next/navigation";
import { markAllMediaReadAction } from "@/application/actions";
import { loadMediaPageView } from "@/application/game-service";
import { MediaFeed } from "@/components/media-hub/MediaFeed";
import { MediaTabNav } from "@/components/media-hub/MediaTabNav";
import { MediaUnreadBadge } from "@/components/media-hub/MediaUnreadBadge";
import { SocialFeed } from "@/components/media-hub/SocialFeed";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";

type MediaPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    tab?: string;
    filter?: string;
  }>;
};

/**
 * League Media Hub — stories, social reactions, and franchise attention.
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

  const attention = view.franchiseAttention;

  return (
    <>
      <PageHeader
        title="Media"
        subtitle="League stories and social reaction for your franchise"
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

      <MediaTabNav
        saveId={saveId}
        activeTab={view.tab}
        latestFilter={view.latestFilter}
        unreadCount={view.unreadCount}
      />

      {view.tab === "social" ? (
        <SocialFeed posts={view.socialPosts} />
      ) : (
        <MediaFeed
          items={view.items.map((item) => ({
            ...item,
            saveId,
            returnPath,
          }))}
        />
      )}

      <Section title="Franchise Attention">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Media attention"
            value={`${attention.mediaAttention}`}
          />
          <StatCard label="Awareness" value={`${attention.awareness}`} />
          <StatCard
            label="Fan sentiment"
            value={`${attention.fanSentiment}`}
          />
          <StatCard label="Reputation" value={`${attention.reputation}`} />
        </section>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          <li>
            Demand contribution (forecast):{" "}
            {attention.demandWeighted != null
              ? attention.demandWeighted
              : "—"}{" "}
            weighted points
          </li>
          <li>
            Higher media attention slightly increases monthly sponsorship cash
            (tuning range ~0.85–1.25). It does not guarantee ROI.
          </li>
          <li>
            Media rises from simulation events and decays weekly toward neutral.
          </li>
        </ul>
      </Section>
    </>
  );
}
