import type { CoachId, TeamId } from "@/domain/ids";

export type Coach = {
  id: CoachId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
};

export type CoachInput = {
  id: CoachId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
};

export function createCoach(input: CoachInput): Coach {
  if (typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new Error("Coach id must be a non-empty string.");
  }
  if (input.teamId !== null) {
    if (typeof input.teamId !== "string" || input.teamId.trim().length === 0) {
      throw new Error("Coach teamId must be a non-empty string or null.");
    }
  }
  if (typeof input.firstName !== "string" || input.firstName.trim().length === 0) {
    throw new Error("Coach firstName must be a non-empty string.");
  }
  if (typeof input.lastName !== "string" || input.lastName.trim().length === 0) {
    throw new Error("Coach lastName must be a non-empty string.");
  }
  return {
    id: input.id,
    teamId: input.teamId,
    firstName: input.firstName,
    lastName: input.lastName,
  };
}
