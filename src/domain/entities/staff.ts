import type { StaffId, TeamId } from "@/domain/ids";

export type StaffRole = "general_manager" | "scout" | "trainer" | "other";

export type Staff = {
  id: StaffId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  role: StaffRole;
};
