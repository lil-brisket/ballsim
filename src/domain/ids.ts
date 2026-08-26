export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type PlayerId = Brand<string, "PlayerId">;
export type TeamId = Brand<string, "TeamId">;
export type LeagueId = Brand<string, "LeagueId">;
export type ConferenceId = Brand<string, "ConferenceId">;
export type DivisionId = Brand<string, "DivisionId">;
export type ContractId = Brand<string, "ContractId">;
export type OfferId = Brand<string, "OfferId">;
export type CoachId = Brand<string, "CoachId">;
export type StaffId = Brand<string, "StaffId">;
export type ArenaId = Brand<string, "ArenaId">;
export type GameId = Brand<string, "GameId">;
export type PossessionId = Brand<string, "PossessionId">;
export type SeasonId = Brand<string, "SeasonId">;
export type PlayoffSeriesId = Brand<string, "PlayoffSeriesId">;
export type DomainEventId = Brand<string, "DomainEventId">;
export type SaveId = Brand<string, "SaveId">;
export type OwnerObjectiveId = Brand<string, "OwnerObjectiveId">;
export type OwnerNotificationId = Brand<string, "OwnerNotificationId">;
export type DraftPickId = Brand<string, "DraftPickId">;
export type DraftClassId = Brand<string, "DraftClassId">;
export type ScheduledEventId = Brand<string, "ScheduledEventId">;
export type StaffContractId = Brand<string, "StaffContractId">;
export type SponsorshipId = Brand<string, "SponsorshipId">;
export type NarrativeSituationId = Brand<string, "NarrativeSituationId">;
export type OwnerDecisionId = Brand<string, "OwnerDecisionId">;

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

export function asOfferId(value: string): OfferId {
  return value as OfferId;
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

export function asOwnerObjectiveId(value: string): OwnerObjectiveId {
  return value as OwnerObjectiveId;
}

export function asOwnerNotificationId(value: string): OwnerNotificationId {
  return value as OwnerNotificationId;
}

export function asDraftPickId(value: string): DraftPickId {
  return value as DraftPickId;
}

export function asDraftClassId(value: string): DraftClassId {
  return value as DraftClassId;
}

export function asScheduledEventId(value: string): ScheduledEventId {
  return value as ScheduledEventId;
}

export function asStaffContractId(value: string): StaffContractId {
  return value as StaffContractId;
}

export function asSponsorshipId(value: string): SponsorshipId {
  return value as SponsorshipId;
}

export function asNarrativeSituationId(value: string): NarrativeSituationId {
  return value as NarrativeSituationId;
}

export function asOwnerDecisionId(value: string): OwnerDecisionId {
  return value as OwnerDecisionId;
}
