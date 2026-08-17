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
  const mediaContributor = biz.forecast.demandContributors.find(
    (c) => c.key === "mediaAttention",
  );

  return (
    <>
      <PageHeader
        title="Media"
        subtitle="Media attention feeds demand and can scale monthly sponsorship payouts"
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Media attention" value={`${biz.mediaAttention}`} />
        <StatCard label="Awareness" value={`${biz.awareness}`} />
        <StatCard label="Fan sentiment" value={`${biz.fanSentiment}`} />
        <StatCard label="Reputation" value={`${biz.reputation}`} />
      </section>

      <Section title="How media affects the franchise">
        <ul className="space-y-2 text-sm text-zinc-300">
          <li>
            Demand contribution (forecast):{" "}
            {mediaContributor ? mediaContributor.weighted : "—"} weighted points
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

      <Section title="About">
        <EmptyState message="There is no separate news desk in this build. Attention is updated by simulation events and weekly decay." />
      </Section>
    </>
  );
}
