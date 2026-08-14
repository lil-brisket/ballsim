import type { PlayerId, TeamId } from "@/domain/ids";

export type PlayerPosition = "PG" | "SG" | "SF" | "PF" | "C";

export type Player = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  age: number;
};
