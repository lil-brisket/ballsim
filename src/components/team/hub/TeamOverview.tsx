import { Section } from "@/components/ui/Section";
import { cn, panelClass } from "@/components/ui/styles";
import type { TeamHubView } from "@/state/team-hub-selectors";
import { groupRankLabel, leagueRankLabel } from "@/presentation/rank-label";

function playoffStatusLabel(label: string | null): string {
  if (label == null || label === "na") {
    return "—";
  }
  switch (label) {
    case "clinched":
      return "Clinched";
    case "playoff":
      return "Playoff";
    case "play_in":
      return "Play-In";
    case "bubble":
      return "Bubble";
    case "eliminated":
      return "Eliminated";
    default:
      return label;
  }
}

/**
 * Current-state overview — replaces Team Snapshot.
 * Uses existing record / standings / form / injury counts only.
 */
export function TeamOverview(props: { hub: TeamHubView }) {
  const { hub } = props;
  const conferenceLine =
    hub.standings.conferenceRank != null && hub.standings.conferenceName
      ? groupRankLabel(
          hub.standings.conferenceName,
          hub.standings.conferenceRank,
        )
      : hub.leagueRank == null
        ? "Unranked"
        : leagueRankLabel(hub.leagueRank);

  return (
    <Section title="Overview">
      <dl
        className={cn(
          panelClass,
          "grid grid-cols-2 gap-3 px-4 py-4 text-sm sm:grid-cols-3",
        )}
      >
        <div>
          <dt className="text-sm text-muted">Record</dt>
          <dd className="tabular-nums text-ink">
            {hub.wins}–{hub.losses}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Conference</dt>
          <dd className="min-w-0 truncate text-ink">{conferenceLine}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Games back</dt>
          <dd className="tabular-nums text-ink">
            {hub.standings.gamesBack != null ? hub.standings.gamesBack : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Playoff status</dt>
          <dd className="text-ink">
            {playoffStatusLabel(hub.standings.playoffLabel)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Form (L5)</dt>
          <dd className="tabular-nums text-ink">
            {hub.recentForm.marks || "—"}
            {hub.recentForm.streak ? (
              <span className="ml-2 text-sm text-faint">
                {hub.recentForm.streak}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Roster health</dt>
          <dd className="text-ink">
            {hub.healthyCount} healthy
            {hub.injuredCount > 0 ? (
              <span className="text-danger"> · {hub.injuredCount} injured</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </Section>
  );
}
