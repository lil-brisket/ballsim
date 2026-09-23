/**
 * Optional economic/gameplay effects — stored for future use.
 * M3 does not apply these; holidays are presentation-only.
 */
export type HolidayEffectConfig = {
  attendanceMultiplier?: number;
  merchandiseMultiplier?: number;
  mediaEngagementBump?: number;
};

export type HolidayDefinition = {
  key: string;
  title: string;
  shortLabel: string;
  /** Day offset from midseason anchor (can be negative). */
  offsetFromAnchor: number;
  /** Inclusive duration in days (1 = single day). */
  durationDays: number;
  effects?: HolidayEffectConfig;
};

export type HolidayInstanceStatus =
  | "scheduled"
  | "active"
  | "completed"
  | "cancelled";

export type HolidayInstance = {
  key: string;
  title: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
  status: HolidayInstanceStatus;
  effects?: HolidayEffectConfig;
};
