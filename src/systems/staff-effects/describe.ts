import {
  STAFF_ROLE_EFFECT_MODULE,
  type StaffRole,
} from "@/domain/entities/staff-roles";
import type { GameState } from "@/state/game-state";
import {
  buildTeamStaffGameContext,
  headCoachSimModifiers,
} from "@/systems/staff-effects/coach-effects";
import { combinedStaffDevelopmentMultiplier } from "@/systems/staff-effects/development-effects";
import {
  financeOpexEfficiencyMultiplier,
  financeRevenueEfficiencyMultiplier,
} from "@/systems/staff-effects/finance-effects";
import { gmTradeAcceptanceThreshold } from "@/systems/staff-effects/gm-effects";
import {
  medicalEffectivenessScore,
  medicalPreventionMultiplier,
  medicalRecoveryMultiplier,
} from "@/systems/staff-effects/medical-effects";
import {
  prMarketabilityMultiplier,
  prReputationModifier,
} from "@/systems/staff-effects/pr-effects";
import {
  scoutInternationalModifier,
  scoutNoiseScale,
  scoutQualityMultiplier,
  scoutSpeedMultiplier,
} from "@/systems/staff-effects/scout-effects";

export type StaffEffectView = {
  label: string;
  value: string | number;
};

function formatMultiplier(mult: number): string {
  const pct = Math.round((mult - 1) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function formatDelta(delta: number): string {
  const pct = Math.round(delta * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/**
 * Presentation rows for a staff member's live team effects.
 * Calls existing module functions; does not recompute formulas.
 */
export function describeStaffEffects(
  state: GameState,
  staffId: string,
): StaffEffectView[] {
  const staff = state.world.staff[staffId];
  if (!staff || staff.teamId === null) {
    return [];
  }

  const teamId = staff.teamId;
  const role = staff.role as StaffRole;
  const moduleKey = STAFF_ROLE_EFFECT_MODULE[role];
  const rows: StaffEffectView[] = [];

  switch (moduleKey) {
    case "gm":
      rows.push({
        label: "Trade acceptance threshold",
        value: Number(gmTradeAcceptanceThreshold(state, teamId).toFixed(3)),
      });
      break;
    case "finance":
      rows.push({
        label: "Revenue efficiency",
        value: formatMultiplier(
          financeRevenueEfficiencyMultiplier(state, teamId),
        ),
      });
      rows.push({
        label: "OpEx efficiency",
        value: formatMultiplier(financeOpexEfficiencyMultiplier(state, teamId)),
      });
      break;
    case "coach":
      if (role === "head_coach") {
        const mods = headCoachSimModifiers(state, teamId);
        rows.push({
          label: "Tempo bonus",
          value: formatDelta(mods.tempoBonus),
        });
        rows.push({
          label: "Efficiency bonus",
          value: formatDelta(mods.efficiencyBonus),
        });
      } else {
        const ctx = buildTeamStaffGameContext(state, teamId);
        rows.push({
          label: "Preparation modifier",
          value: formatDelta(ctx.preparationModifier),
        });
      }
      break;
    case "development":
      rows.push({
        label: "Development multiplier",
        value: formatMultiplier(
          combinedStaffDevelopmentMultiplier(state, teamId),
        ),
      });
      break;
    case "scout":
      rows.push({
        label: "Scout noise scale",
        value: Number(scoutNoiseScale(state, teamId).toFixed(2)),
      });
      rows.push({
        label: "Scout quality",
        value: formatMultiplier(scoutQualityMultiplier(state, teamId)),
      });
      rows.push({
        label: "Scout speed",
        value: formatMultiplier(scoutSpeedMultiplier(state, teamId)),
      });
      rows.push({
        label: "International",
        value: formatMultiplier(scoutInternationalModifier(state, teamId)),
      });
      break;
    case "medical": {
      const score = medicalEffectivenessScore(state, teamId);
      rows.push({
        label: "Injury prevention",
        value: formatMultiplier(medicalPreventionMultiplier(state, teamId)),
      });
      rows.push({
        label: "Recovery",
        value: formatMultiplier(medicalRecoveryMultiplier(state, teamId)),
      });
      rows.push({
        label: "Effectiveness",
        value: score ?? "—",
      });
      break;
    }
    case "pr": {
      const reputation = prReputationModifier(state, teamId);
      rows.push({
        label: "Reputation",
        value: `${reputation > 0 ? "+" : ""}${Number(reputation.toFixed(2))}`,
      });
      rows.push({
        label: "Marketability",
        value: formatMultiplier(prMarketabilityMultiplier(state, teamId)),
      });
      break;
    }
    default:
      break;
  }

  return rows;
}
