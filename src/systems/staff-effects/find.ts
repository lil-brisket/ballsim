import type { Staff, StaffRole } from "@/domain/entities/staff";
import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";

export function findTeamStaffByRole(
  state: GameState,
  teamId: TeamId,
  role: StaffRole,
): Staff | null {
  const team = state.world.teams[teamId];
  if (!team) {
    return null;
  }
  for (const staffId of team.staff) {
    const staff = state.world.staff[staffId];
    if (staff && staff.teamId === teamId && staff.role === role) {
      return staff;
    }
  }
  return null;
}
