import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
import { PageHeader } from "@/components/ui/PageHeader";
import { AwardsViewSwitch } from "@/components/history/AwardsViewSwitch";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { formatGameDate } from "@/presentation/game-date";
import {
  toFanVotingHubView,
  type FanVotingHubView,
} from "@/state/fan-voting-selectors";

export const metadata: Metadata = { title: "Fan Voting" };

type PageProps = {
  params: Promise<{ saveId: string }>;
};

function noVotesMessage(hub: FanVotingHubView): {
  title: string;
  message: string;
} {
  if (hub.status === "scheduled" && hub.openDate) {
    return {
      title: "Voting hasn't started",
      message: `Fans can start voting on ${formatGameDate(hub.openDate, { weekday: true, year: true })}. Vote totals will show here once voting opens.`,
    };
  }
  if (hub.status === "open") {
    return {
      title: "Voting is open",
      message: "The first vote totals arrive after the next day of voting.",
    };
  }
  return {
    title: "No voting results",
    message: "Fan voting has not been planned for this season yet.",
  };
}

function movementGlyph(movement: string): string {
  if (movement === "up") return "▲";
  if (movement === "down") return "▼";
  if (movement === "same") return "─";
  return "•";
}

export default async function FanVotingPage({ params }: PageProps) {
  const { saveId } = await params;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) notFound();

  const hub = toFanVotingHubView(loaded.state);

  return (
    <div className="space-y-4">
      <AwardsViewSwitch saveId={saveId} active="fan-voting" />
      <PageHeader
        title={hub.title}
        subtitle={
          hub.status === "open" && hub.daysRemaining != null
            ? `Voting closes in ${hub.daysRemaining} day${hub.daysRemaining === 1 ? "" : "s"}`
            : hub.status === "finalized" || hub.status === "closed"
              ? "Voting has closed"
              : hub.status === "scheduled" && hub.openDate
                ? `Opens ${formatGameDate(hub.openDate, { year: true })}`
                : "No active fan voting campaign"
        }
      />

      {hub.conferences.length === 0 ? (
        <EmptyState {...noVotesMessage(hub)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {hub.conferences.map((conference) => (
            <Section key={conference.id} title={conference.label}>
              <ol className="divide-y divide-line">
                {conference.leaders.map((row) => (
                  <li
                    key={row.playerId}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-6 shrink-0 font-semibold text-muted">
                        {row.rank}
                      </span>
                      <div className="min-w-0">
                        <PlayerEntityLink
                          saveId={saveId}
                          playerId={row.playerId}
                          className="font-medium text-ink"
                        >
                          {row.playerName}
                        </PlayerEntityLink>
                        {row.teamId && row.teamName ? (
                          <div className="text-sm text-faint">
                            <TeamEntityLink saveId={saveId} teamId={row.teamId}>
                              {row.teamName}
                            </TeamEntityLink>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-soft">
                      <span>{row.voteTotal.toLocaleString()}</span>
                      <span
                        className={
                          row.movement === "up"
                            ? "text-emerald-400"
                            : row.movement === "down"
                              ? "text-rose-400"
                              : "text-faint"
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
          ))}
        </div>
      )}
    </div>
  );
}
