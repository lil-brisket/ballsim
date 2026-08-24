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
} from "@/systems/narrative/lifecycle";
