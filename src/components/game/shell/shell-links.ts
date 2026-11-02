/** Window event the command palette listens for. */
export const OPEN_COMMAND_PALETTE = "ballsim:command-palette";

/**
 * Where Sim goes (header button, Home hero): the calendar's next-game
 * focus, which owns the confirm and blocking rules.
 */
export function simHref(saveId: string): string {
  return `/dashboard/${saveId}/calendar?focus=next-game`;
}
