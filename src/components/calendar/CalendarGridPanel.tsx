"use client";

import type { CalendarPageView } from "@/application/game-service";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import type { CalendarMonthGrid } from "@/systems/calendar";

export function CalendarGridPanel(props: {
  grid: CalendarMonthGrid;
  view: CalendarPageView;
  selectedDate: string;
  currentDate: string;
  navigationDisabled: boolean;
  resultOverlays: Record<string, string>;
  simulating: boolean;
  onSelectDate: (date: string) => void;
  onChangeMonth: (year: number, month: number) => void;
  onJumpToday: () => void;
  onJumpNextGame: () => void;
}) {
  return (
    <CalendarMonthView
      grid={props.grid}
      selectedDate={props.selectedDate}
      currentDate={props.currentDate}
      nextTeamGameDate={props.view.nextTeamGameDate}
      navigationDisabled={props.navigationDisabled}
      resultOverlays={props.resultOverlays}
      teamBranding={props.view.teamBranding}
      simulating={props.simulating}
      onSelectDate={props.onSelectDate}
      onChangeMonth={props.onChangeMonth}
      onJumpToday={props.onJumpToday}
      onJumpNextGame={props.onJumpNextGame}
      layout="grid"
    />
  );
}
