import type { Calendar } from "@/domain/entities/calendar";
import type { Coach } from "@/domain/entities/coach";
import type { Conference } from "@/domain/entities/conference";
import type { Contract } from "@/domain/entities/contract";
import type { Division } from "@/domain/entities/division";
import type { TeamFinances } from "@/domain/entities/finances";
import type { Game } from "@/domain/entities/game";
import type { League } from "@/domain/entities/league";
import type { Player } from "@/domain/entities/player";
import type { Schedule } from "@/domain/entities/schedule";
import type { Season } from "@/domain/entities/season";
import type { Staff } from "@/domain/entities/staff";
import type { Standings } from "@/domain/entities/standings";
import type { Team } from "@/domain/entities/team";
import type { SaveId, TeamId } from "@/domain/ids";

export const GAME_STATE_SCHEMA_VERSION = 11;

export type GameMode = "owner";

export type MetaSlice = {
  saveId: SaveId;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  /** Original seed for the save (reproducibility / debugging). */
  rngSeed: number;
  /** Current PRNG internal state; resume streams across advances. */
  rngState: number;
};

export type WorldSlice = {
  calendar: Calendar;
  league: League;
  conferences: Record<string, Conference>;
  divisions: Record<string, Division>;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  coaches: Record<string, Coach>;
  staff: Record<string, Staff>;
};

export type CompetitionSlice = {
  season: Season;
  schedule: Schedule;
  games: Record<string, Game>;
  standings: Standings;
};

export type BusinessSlice = {
  contracts: Record<string, Contract>;
  finances: Record<string, TeamFinances>;
};

export type UserSlice = {
  controlledTeamId: TeamId;
  mode: GameMode;
};

/**
 * Authoritative game model for one save.
 * Composed of typed slices to avoid a single undifferentiated object.
 */
export type GameState = {
  meta: MetaSlice;
  world: WorldSlice;
  competition: CompetitionSlice;
  business: BusinessSlice;
  user: UserSlice;
};
