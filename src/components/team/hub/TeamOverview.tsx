import { Section } from "@/components/owner/Section";
import { cn, panelClass } from "@/components/ui/styles";
import type { TeamHubView } from "@/state/team-hub-selectors";

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

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
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
      ? `${hub.standings.conferenceRank}${ordinal(hub.standings.conferenceRank)} · ${hub.standings.conferenceName}`
      : `#${hub.leagueRank} overall`;

  return (
    <Section title="Overview">
      <dl
        className={cn(
          panelClass,
          "grid grid-cols-2 gap-3 px-4 py-4 text-sm sm:grid-cols-3",
        )}
      >
        <div>
          <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
            Record
          </dt>
          <dd className="font-mono text-zinc-100">
            {hub.wins}–{hub.losses}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
            Conference
          </dt>
          <dd className="min-w-0 truncate text-zinc-100">{conferenceLine}</dd>
        </div>
        <div>
          <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
            Games Back
          </dt>
          <dd className="font-mono text-zinc-100">
            {hub.standings.gamesBack != null ? hub.standings.gamesBack : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
            Playoff Status
          </dt>
          <dd className="text-zinc-100">
            {playoffStatusLabel(hub.standings.playoffLabel)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
            Form (L5)
          </dt>
          <dd className="font-mono text-zinc-100">
            {hub.recentForm.marks || "—"}
            {hub.recentForm.streak ? (
              <span className="ml-2 text-xs text-zinc-500">
                {hub.recentForm.streak}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.65rem] uppercase text-zinc-500">
            Roster Health
          </dt>
          <dd className="text-zinc-100">
            {hub.healthyCount} healthy
            {hub.injuredCount > 0 ? (
              <span className="text-rose-400">
                {" "}
                · {hub.injuredCount} injured
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </Section>
  );
}
