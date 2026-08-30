export {
  evaluateProspectForTeam,
  buildScoutEvaluationContext,
  computeEffectiveExposure,
  knowledgeLevelFromEffectiveExposure,
  prospectUncertainty,
  scoutGradeFromEstimated,
  confidenceFromWidth,
  EXPOSURE_BASIC,
  EXPOSURE_DEVELOPING,
  EXPOSURE_DETAILED,
  EXPOSURE_COMPREHENSIVE,
} from "@/systems/scouting/scouting-accuracy";
export {
  buildScoutingReport,
  deriveStrengthsWeaknessesFromEstimates,
  toScoutingReportView,
  type ScoutingReportPresentation,
  type ScoutingReportView,
} from "@/systems/scouting/scouting-reports";
export {
  advanceScoutAssignments,
  assignScoutToProspect,
  scoutRegionCoverage,
  getScoutingCoverageSummary,
} from "@/systems/scouting/scouting-progression";
