/** Weekly decay toward neutral media attention (50). */
export const MEDIA_WEEKLY_DECAY = 0.08;

/** Event-type media bumps (additive, before clamp). */
export const MEDIA_EVENT_BUMPS: Partial<
  Record<
    | "GameCompleted"
    | "PlayerTraded"
    | "CoachHired"
    | "StaffHired"
    | "FacilityUpgradeCompleted"
    | "SponsorshipSigned"
    | "RelocationStageChanged"
    | "ExpansionStageChanged"
    | "GameDayPromotionSettled",
    number
  >
> = {
  GameCompleted: 1,
  PlayerTraded: 4,
  CoachHired: 3,
  StaffHired: 2,
  FacilityUpgradeCompleted: 2,
  SponsorshipSigned: 3,
  RelocationStageChanged: 5,
  ExpansionStageChanged: 6,
  GameDayPromotionSettled: 2,
};
