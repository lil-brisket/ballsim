export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type PlayerId = Brand<string, "PlayerId">;
export type TeamId = Brand<string, "TeamId">;
export type LeagueId = Brand<string, "LeagueId">;
export type ConferenceId = Brand<string, "ConferenceId">;
export type DivisionId = Brand<string, "DivisionId">;
export type ContractId = Brand<string, "ContractId">;
export type CoachId = Brand<string, "CoachId">;
export type StaffId = Brand<string, "StaffId">;
export type ArenaId = Brand<string, "ArenaId">;
export type GameId = Brand<string, "GameId">;
export type PossessionId = Brand<string, "PossessionId">;
export type SeasonId = Brand<string, "SeasonId">;
export type PlayoffSeriesId = Brand<string, "PlayoffSeriesId">;
export type DomainEventId = Brand<string, "DomainEventId">;
export type SaveId = Brand<string, "SaveId">;

export function asPlayerId(value: string): PlayerId {
  return value as PlayerId;
}

export function asTeamId(value: string): TeamId {
  return value as TeamId;
}

export function asLeagueId(value: string): LeagueId {
  return value as LeagueId;
}

export function asConferenceId(value: string): ConferenceId {
  return value as ConferenceId;
}

export function asDivisionId(value: string): DivisionId {
  return value as DivisionId;
}

export function asContractId(value: string): ContractId {
  return value as ContractId;
}

export function asCoachId(value: string): CoachId {
  return value as CoachId;
}

export function asStaffId(value: string): StaffId {
  return value as StaffId;
}

export function asArenaId(value: string): ArenaId {
  return value as ArenaId;
}

export function asGameId(value: string): GameId {
  return value as GameId;
}

export function asPossessionId(value: string): PossessionId {
  return value as PossessionId;
}

export function asSeasonId(value: string): SeasonId {
  return value as SeasonId;
}

export function asPlayoffSeriesId(value: string): PlayoffSeriesId {
  return value as PlayoffSeriesId;
}

export function asDomainEventId(value: string): DomainEventId {
  return value as DomainEventId;
}

export function asSaveId(value: string): SaveId {
  return value as SaveId;
}
