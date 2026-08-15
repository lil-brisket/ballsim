import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";

type MediaPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Informational media attention from franchise business view.
 * Does not invent a news feed or media gameplay.
 */
export default async function MediaPage({
  params,
  searchParams,
}: MediaPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const biz = view.franchiseBusiness;

  return (
    <>
      <PageHeader
        title="Media"
        subtitle="Current media attention and related franchise metrics (informational)"
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Media attention" value={`${biz.mediaAttention}`} />
        <StatCard label="Awareness" value={`${biz.awareness}`} />
        <StatCard label="Fan sentiment" value={`${biz.fanSentiment}`} />
        <StatCard label="Reputation" value={`${biz.reputation}`} />
      </section>

      <Section title="About">
        <EmptyState message="Media attention is updated by simulation events and weekly decay. There is no separate news desk in this build." />
      </Section>
    </>
  );
}
