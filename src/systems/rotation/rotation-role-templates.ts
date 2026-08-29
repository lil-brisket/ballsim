/**
 * Role defaults and philosophy/depth modifiers for Auto Optimize + migration.
 */

import type {
  RotationPhilosophy,
  RotationPriority,
  RotationRole,
  RotationStatus,
} from "@/domain/entities/team-roster-management";

export type RoleTemplate = {
  target: number;
  min: number;
  normalMax: number;
  absoluteMax: number;
  priority: RotationPriority;
  status: RotationStatus;
};

export const ROLE_TEMPLATES: Record<RotationRole, RoleTemplate> = {
  starter: {
    target: 34,
    min: 28,
    normalMax: 38,
    absoluteMax: 44,
    priority: 1,
    status: "active",
  },
  sixth_man: {
    target: 24,
    min: 16,
    normalMax: 30,
    absoluteMax: 36,
    priority: 2,
    status: "active",
  },
  rotation: {
    target: 18,
    min: 10,
    normalMax: 24,
    absoluteMax: 30,
    priority: 3,
    status: "active",
  },
  bench: {
    target: 8,
    min: 0,
    normalMax: 14,
    absoluteMax: 20,
    priority: 4,
    status: "active",
  },
  deep_bench: {
    target: 6,
    min: 0,
    normalMax: 12,
    absoluteMax: 18,
    priority: 5,
    status: "active",
  },
  emergency: {
    target: 0,
    min: 0,
    normalMax: 6,
    absoluteMax: 12,
    priority: 5,
    status: "emergency",
  },
};

/**
 * Infer expanded role from legacy starter/bench + planned minutes.
 */
export function inferRoleFromLegacy(
  legacyRole: "starter" | "bench",
  plannedMinutes: number,
): RotationRole {
  if (legacyRole === "starter") {
    return "starter";
  }
  if (plannedMinutes >= 22) {
    return "sixth_man";
  }
  if (plannedMinutes >= 14) {
    return "rotation";
  }
  if (plannedMinutes >= 6) {
    return "bench";
  }
  if (plannedMinutes > 0) {
    return "deep_bench";
  }
  return "emergency";
}

/**
 * Philosophy multipliers applied when distributing target minutes.
 * Values > 1 push more minutes to top priority players.
 */
export function philosophyMinuteSkew(
  philosophy: RotationPhilosophy,
): { topShare: number; depthShare: number } {
  switch (philosophy) {
    case "star_heavy":
      return { topShare: 0.8, depthShare: 0.2 };
    case "tight":
      return { topShare: 0.76, depthShare: 0.24 };
    case "deep":
      return { topShare: 0.65, depthShare: 0.35 };
    case "development":
      return { topShare: 0.62, depthShare: 0.38 };
    case "balanced":
    default:
      return { topShare: 0.72, depthShare: 0.28 };
  }
}

export function applyTemplateToMinutes(
  role: RotationRole,
  targetMinutes: number,
): Pick<
  RoleTemplate,
  "min" | "normalMax" | "absoluteMax" | "priority" | "status"
> {
  const template = ROLE_TEMPLATES[role];
  // Scale min/max around template when target differs significantly
  const scale =
    template.target > 0 ? Math.max(0.5, targetMinutes / template.target) : 1;
  return {
    min: Math.max(0, Math.round(template.min * Math.min(scale, 1.2))),
    normalMax: Math.max(
      targetMinutes,
      Math.round(template.normalMax * Math.min(scale, 1.15)),
    ),
    absoluteMax: Math.max(
      targetMinutes,
      Math.round(template.absoluteMax * Math.min(scale, 1.1)),
    ),
    priority: template.priority,
    status: template.status,
  };
}
