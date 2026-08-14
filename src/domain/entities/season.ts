import type { SeasonId } from "@/domain/ids";

export type SeasonPhase =
  | "preseason"
  | "regular"
  | "playoffs"
  | "offseason";

export type Season = {
  id: SeasonId;
  year: number;
  phase: SeasonPhase;
};
