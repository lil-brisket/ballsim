import { AwardHistoryPanel } from "@/components/history/AwardHistoryPanel";
import { CurrentSeasonAwards } from "@/components/history/CurrentSeasonAwards";
import { HistoryHubHeader } from "@/components/history/HistoryHubHeader";
import { LeagueHistoryTable } from "@/components/history/LeagueHistoryTable";
import { PlayerHistoryPanel } from "@/components/history/PlayerHistoryPanel";
import { TeamRecordsPanel } from "@/components/history/TeamRecordsPanel";
import type { HistoryHubView } from "@/state/history-hub-selectors";

export function HistoryHub(props: { view: HistoryHubView }) {
  const { view } = props;
  return (
    <>
      <HistoryHubHeader saveId={view.saveId} route={view.route} activeTab={view.tab} />
      {view.currentSeason ? (
        <CurrentSeasonAwards
          saveId={view.saveId}
          seasonYear={view.currentSeasonYear}
          groups={view.currentSeason}
        />
      ) : null}
      {view.awardHistory ? (
        <AwardHistoryPanel saveId={view.saveId} route={view.route} view={view.awardHistory} />
      ) : null}
      {view.leagueHistory ? (
        <LeagueHistoryTable saveId={view.saveId} view={view.leagueHistory} />
      ) : null}
      {view.teamRecords ? (
        <TeamRecordsPanel
          saveId={view.saveId}
          route={view.route}
          rows={view.teamRecords}
          selectedTeam={view.selectedTeam}
          ownerFranchise={view.ownerFranchise}
          ownerStory={view.ownerStory}
        />
      ) : null}
      {view.playerIndex ? (
        <PlayerHistoryPanel
          saveId={view.saveId}
          route={view.route}
          index={view.playerIndex}
          selectedPlayer={view.selectedPlayer}
        />
      ) : null}
    </>
  );
}
