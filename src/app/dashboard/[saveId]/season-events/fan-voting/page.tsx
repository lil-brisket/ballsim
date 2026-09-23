import { notFound } from "next/navigation";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { EmptyState } from "@/components/owner/EmptyState";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { toFanVotingHubView } from "@/state/fan-voting-selectors";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

function movementGlyph(movement: string): string {
  if (movement === "up") return "▲";
  if (movement === "down") return "▼";
  if (movement === "same") return "─";
  return "•";
}

export default async function FanVotingPage({ params }: PageProps) {
  const { saveId } = await params;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) notFound();

  const hub = toFanVotingHubView(loaded.state);

  return (
    <div className="space-y-4">
      <PageHeader
        title={hub.title}
        subtitle={
          hub.status === "open" && hub.daysRemaining != null
            ? `Voting closes in ${hub.daysRemaining} day${hub.daysRemaining === 1 ? "" : "s"}`
            : hub.status === "finalized" || hub.status === "closed"
              ? "Voting has closed"
              : hub.status === "scheduled"
                ? `Opens ${hub.openDate ?? ""}`
                : "No active fan voting campaign"
        }
      />

      {hub.categories.length === 0 ? (
        <EmptyState
          title="No voting categories"
          message="Fan voting has not been planned for this season yet."
        />
      ) : (
        hub.categories.map((category) => (
          <Section key={category.id} title={category.label}>
            <ol className="divide-y divide-zinc-800">
              {category.leaders.map((row) => (
                <li
                  key={row.playerId}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 shrink-0 font-semibold text-zinc-400">
                      {row.rank}
                    </span>
                    <div className="min-w-0">
                      <PlayerEntityLink
                        saveId={saveId}
                        playerId={row.playerId}
                        className="font-medium text-zinc-100"
                      >
                        {row.playerName}
                      </PlayerEntityLink>
                      {row.teamId && row.teamName ? (
                        <div className="text-xs text-zinc-500">
                          <TeamEntityLink saveId={saveId} teamId={row.teamId}>
                            {row.teamName}
                          </TeamEntityLink>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 font-mono text-zinc-300">
                    <span>{row.voteTotal.toLocaleString()}</span>
                    <span
                      className={
                        row.movement === "up"
                          ? "text-emerald-400"
                          : row.movement === "down"
                            ? "text-rose-400"
                            : "text-zinc-500"
                      }
                      title={
                        row.previousRank != null
                          ? `Was #${row.previousRank}`
                          : "New"
                      }
                    >
                      {movementGlyph(row.movement)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        ))
      )}
    </div>
  );
}
