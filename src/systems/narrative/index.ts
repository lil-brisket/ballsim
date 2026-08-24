export { buildNarrativeContext, appendMonthSnapshot, buildMonthSnapshot } from "@/systems/narrative/build-narrative-context";
export { processNarrativeLayer } from "@/systems/narrative/evaluate-narrative";
export type { ProcessNarrativeOptions } from "@/systems/narrative/evaluate-narrative";
export type {
  NarrativeCadence,
  NarrativeContext,
  DetectorCandidate,
} from "@/systems/narrative/types";
export {
  acknowledgeSituation,
  resolveSituation,
  findOpenSituation,
  expireDueSituations,
} from "@/systems/narrative/lifecycle";
export {
  detectSponsorVisibilityConcern,
  detectMediaOwnershipPressure,
  enrichAttendanceDeclineActions,
  ATTENDANCE_TO_SPONSOR_DAYS,
  SPONSOR_TO_MEDIA_DAYS,
} from "@/systems/narrative/attendance-crisis-chain";
