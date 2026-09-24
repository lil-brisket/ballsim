import { TeamCard } from "@/components/basketball/TeamCard";
import type { TeamHubView } from "@/state/team-hub-selectors";

export function TeamHubHeader(props: { hub: TeamHubView }) {
  const { hub } = props;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
          Team Hub
        </p>
        <h1 className="mt-1 truncate text-2xl font-medium text-zinc-50">
          {hub.city} {hub.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {hub.wins}–{hub.losses} · #{hub.leagueRank}
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
