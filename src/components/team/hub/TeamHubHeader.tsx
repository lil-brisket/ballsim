import { TeamCard } from "@/components/basketball/TeamCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { TeamHubView } from "@/state/team-hub-selectors";
import { leagueRankLabel } from "@/presentation/rank-label";

export function TeamHubHeader(props: { hub: TeamHubView }) {
  const { hub } = props;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-2">
        <SectionHeading
          as="h1"
          size="lg"
          eyebrow="Team Hub"
          title={`${hub.city} ${hub.name}`}
        />
        <p className="text-sm text-zinc-300">
          {hub.wins}–{hub.losses} · {leagueRankLabel(hub.leagueRank)}
          {hub.recentForm.streak ? ` · ${hub.recentForm.streak}` : ""}
          {" · "}
          {hub.seasonPhase}
          {hub.offseasonStage !== "none" ? ` / ${hub.offseasonStage}` : ""}
        </p>
      </div>
      <TeamCard
        city={hub.city}
        name={hub.name}
        abbreviation={hub.abbreviation}
        branding={hub.branding}
        wins={hub.wins}
        losses={hub.losses}
        rank={hub.leagueRank}
      />
    </header>
  );
}
