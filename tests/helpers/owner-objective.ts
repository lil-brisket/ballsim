import {
  createOwnerObjective,
  type OwnerObjectiveInput,
} from "@/domain/entities/owner-objective";
import { asOwnerObjectiveId } from "@/domain/ids";

/** Test helper: fills mandate fields required after schema v26. */
export function testOwnerObjective(
  overrides: Partial<OwnerObjectiveInput> &
    Pick<OwnerObjectiveInput, "id" | "type" | "description" | "status">,
) {
  const type = overrides.type;
  const category =
    overrides.category ??
    (type === "payroll_limit" ||
    type === "improve_finances" ||
    type === "positive_cash" ||
    type === "revenue_target"
      ? "financial"
      : type === "develop_young_players" || type === "roster_direction"
        ? "strategic"
        : type === "franchise_value" ||
            type === "championship_count" ||
            type === "playoff_count"
          ? "long_term"
          : type === "attendance" ||
              type === "fan_sentiment" ||
              type === "awareness" ||
              type === "reputation" ||
              type === "arena_level"
            ? "franchise"
            : "competitive");
  const role =
    overrides.role ??
    (type === "payroll_limit"
      ? "secondary"
      : type === "franchise_value" ||
          type === "championship_count" ||
          type === "playoff_count"
        ? "long_term"
        : "primary");
  const lifecycle =
    overrides.lifecycle ??
    (type === "championship_count" || type === "playoff_count"
      ? "career"
      : type === "franchise_value"
        ? "multi_season"
        : type === "arena_level"
          ? "milestone"
          : "seasonal");

  return createOwnerObjective({
    seasonYear: 2026,
    consequenceApplied: false,
    category,
    lifecycle,
    role,
    ...overrides,
    id:
      typeof overrides.id === "string"
        ? asOwnerObjectiveId(overrides.id)
        : overrides.id,
  });
}
