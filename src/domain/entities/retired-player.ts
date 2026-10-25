import type { PlayerSeasonStatLine } from "@/domain/entities/player-history";
import type { PlayerPosition } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";

/**
 * Career inputs the legacy rules read (Hall of Fame score, retired numbers,
 * franchise legends), taken from a player's season records.
 */
export type CareerBasis = {
  seasons: number;
  lastSeasonYear: number | null;
  /** Regular-season totals over the whole career. */
  totals: PlayerSeasonStatLine;
  /** Seasons with a team, in career order (ties in team tenure go to the latest). */
  teamSeasons: Array<{ seasonYear: number; teamId: TeamId }>;
};

/**
 * Slim archive of a retired player, kept in the per-action save for good.
 * The full player and his season records leave the save two seasons after
 * he retires (see save-history.ts); identity and career basis stay here.
 */
export type RetiredPlayerRecord = {
  id: PlayerId;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  jerseyNumber: number;
  /** Season whose end he retired at. */
  retiredSeasonYear: number;
  career: CareerBasis;
};
