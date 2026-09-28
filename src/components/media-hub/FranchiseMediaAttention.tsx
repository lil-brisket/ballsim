import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";
import type { MediaFranchiseAttentionView } from "@/state/media-hub-selectors";

export function FranchiseMediaAttention(props: {
  attention: MediaFranchiseAttentionView;
}) {
  const attention = props.attention;
  return (
    <Section title="Franchise Attention">
      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          density="compact"
          label="Media attention"
          value={`${attention.mediaAttention}`}
        />
        <StatCard
          density="compact"
          label="Awareness"
          value={`${attention.awareness}`}
        />
        <StatCard
          density="compact"
          label="Fan sentiment"
          value={`${attention.fanSentiment}`}
        />
        <StatCard
          density="compact"
          label="Reputation"
          value={`${attention.reputation}`}
        />
      </section>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        <li>
          Demand contribution (forecast):{" "}
          {attention.demandWeighted != null ? attention.demandWeighted : "—"}{" "}
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
  );
}
