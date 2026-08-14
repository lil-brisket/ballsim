import type { PlayerId, TeamId } from "@/domain/ids";

export type PlayerPosition = "PG" | "SG" | "SF" | "PF" | "C";

export type PlayerRatings = {
  /** Composite 1–99. */
  overall: number;
  /** Offensive contribution 1–99. */
  offense: number;
  /** Defensive contribution 1–99. */
  defense: number;
};

export type Player = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  age: number;
  ratings: PlayerRatings;
};
