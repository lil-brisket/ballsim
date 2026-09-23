import { notFound } from "next/navigation";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { EmptyState } from "@/components/owner/EmptyState";
import { toMidseasonCupHubView } from "@/state/midseason-cup-selectors";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function MidseasonCupPage({ params }: PageProps) {
  const { saveId } = await params;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) notFound();

  const hub = toMidseasonCupHubView(loaded.state);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Midseason Cup"
        subtitle={
          hub.status === "none"
            ? "Tournament not scheduled for this season"
            : `${hub.format ?? "tournament"} · ${hub.status}`
        }
      />

      {hub.championName ? (
        <Section title="Champion">
          <p className="text-lg font-semibold text-amber-300">
            🏆 {hub.championName}
          </p>
        </Section>
      ) : null}

      {hub.rounds.length === 0 ? (
        <EmptyState
          title="Bracket not ready"
          message="Qualified teams and bracket appear when the Midseason Cup begins."
        />
      ) : (
        hub.rounds.map((round) => (
          <Section key={round.round} title={round.label.toUpperCase()}>
            <ul className="space-y-3">
              {round.series.map((series) => (
                <li
                  key={series.id}
                  className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 font-mono text-sm text-zinc-200"
                >
                  <div>{series.higherName} ─┐</div>
                  <div className="pl-4 text-zinc-400">
                    ├─ {series.winnerName ?? "…"}
                  </div>
                  <div>{series.lowerName} ─┘</div>
                </li>
              ))}
            </ul>
          </Section>
        ))
      )}
    </div>
  );
}
