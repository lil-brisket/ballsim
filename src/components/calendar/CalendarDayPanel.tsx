"use client";

import type { CalendarPageView } from "@/application/game-service";
import { DateInspector } from "@/components/calendar/DateInspector";
import type { CalendarDateInspectorView } from "@/systems/calendar";

/**
 * Date inspector side panel. During playback it follows the simulation
 * cursor; the page's inspector only describes the date selected before the run.
 */
export function CalendarDayPanel(props: {
  view: CalendarPageView;
  saveId: string;
  returnPath: string;
  liveInspector: CalendarDateInspectorView | null;
  busy: boolean;
  simulating: boolean;
  isDesktop: boolean;
  currentDate: string;
  onSimulate: (targetDate: string) => Promise<void>;
  onWatch: (gameId: string, gameDate: string) => void;
}) {
  const { view, liveInspector, isDesktop } = props;
  return (
    <DateInspector
      saveId={props.saveId}
      returnPath={props.returnPath}
      inspector={liveInspector ?? view.inspector}
      timeDisabled={view.timeDisabled || props.busy}
      userTeamId={view.userTeamId}
      simulating={props.simulating}
      onSimulate={props.onSimulate}
      showSimulateAction={isDesktop}
      teamGameStats={liveInspector ? null : view.teamGameStats}
      currentDate={props.currentDate}
      onWatch={props.onWatch}
      hideTitle={!isDesktop}
      userTeamName={`${view.dashboard.controlledTeam.city} ${view.dashboard.controlledTeam.name}`}
      userBranding={view.dashboard.controlledTeam.branding}
      teamBranding={view.teamBranding}
    />
  );
}
