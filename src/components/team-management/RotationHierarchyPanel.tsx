import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import type { RotationRowView, RotationView } from "@/state/team-management-selectors";
import { cn, panelClass } from "@/components/ui/styles";

const STARTER_ROLES = new Set(["starter"]);

function sortByPriority(a: RotationRowView, b: RotationRowView): number {
  return a.rotationPriority - b.rotationPriority;
}

/**
 * Visual starter/bench hierarchy with MPG and role-vs-minutes feedback.
 * Communicates "here's what you've configured" — not what is "correct".
 */
export function RotationHierarchyPanel(props: {
  saveId: string;
  rotation: RotationView;
}) {
  const active = props.rotation.rows.filter(
    (row) => row.role !== "inactive",
  );
  const starters = active
    .filter(
      (row) =>
        STARTER_ROLES.has(row.rotationRole) || row.role === "starter",
    )
    .sort(sortByPriority);
  const starterIds = new Set(starters.map((s) => s.playerId));
  const bench = active
    .filter((row) => !starterIds.has(row.playerId) && row.targetMinutes >= 0)
    .sort(sortByPriority);

  // Role-vs-minutes: sixth man should generally out-minute deeper rotation.
  const sixth = bench.find((r) => r.rotationRole === "sixth_man");
  const deeper = bench.filter(
    (r) =>
      r.rotationRole === "rotation" ||
      r.rotationRole === "bench" ||
      r.rotationRole === "deep_bench",
  );
  const minuteWarnings = new Map<string, string>();
  if (sixth) {
    for (const row of deeper) {
      if (row.targetMinutes > sixth.targetMinutes && sixth.targetMinutes > 0) {
        minuteWarnings.set(
          row.playerId,
          "Rotation player is receiving more minutes than sixth man",
        );
      }
    }
  }

  for (const fb of props.rotation.feedback) {
    if (fb.playerId && fb.kind !== "balanced") {
      minuteWarnings.set(
        fb.playerId,
        minuteWarnings.get(fb.playerId) ?? fb.message,
      );
    }
  }

  function renderRow(row: RotationRowView, indexLabel: string) {
    const warning = minuteWarnings.get(row.playerId);
    const injured = !row.available;
    return (
      <li
        key={row.playerId}
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm",
          injured && "opacity-70",
        )}
      >
        <span className="min-w-0 flex flex-1 items-center gap-2 truncate">
          <span className="w-6 shrink-0 font-mono text-xs text-zinc-500">
            {indexLabel}
          </span>
          <span className="w-8 shrink-0 font-mono text-xs text-zinc-500">
            {row.position}
          </span>
          <PlayerEntityLink saveId={props.saveId} playerId={row.playerId}>
            {row.firstName} {row.lastName}
          </PlayerEntityLink>
          {injured ? (
            <span className="text-xs text-rose-400">
              {row.injuryLabel ?? row.availabilityLabel}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {warning ? (
            <span
              className="max-w-[12rem] truncate text-[0.65rem] text-amber-400"
              title={warning}
            >
              ⚠ {warning}
            </span>
          ) : null}
          <span className="font-mono text-zinc-200">
            {row.targetMinutes} MPG
          </span>
        </span>
      </li>
    );
  }

  return (
    <section className={cn(panelClass, "space-y-4 px-4 py-4")} aria-label="Rotation hierarchy">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Current Rotation
          </p>
          <p className="mt-1 text-sm text-zinc-200">
            {active.filter((r) => r.targetMinutes > 0).length} players ·{" "}
            {props.rotation.totalPlanned} / {props.rotation.target} minutes
            {!props.rotation.plannedValid ? (
              <span className="ml-2 text-amber-400">
                Δ {props.rotation.delta}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-mono text-xs uppercase tracking-wide text-amber-400">
          Starters
        </h3>
        <ul className="mt-1 divide-y divide-zinc-800/80">
          {(starters.length > 0 ? starters : active.slice(0, 5)).map((row, i) =>
            renderRow(row, String(i + 1)),
          )}
        </ul>
      </div>

      <div>
        <h3 className="font-mono text-xs uppercase tracking-wide text-zinc-400">
          Bench
        </h3>
        <ul className="mt-1 divide-y divide-zinc-800/80">
          {(starters.length > 0 ? bench : active.slice(5)).map((row, i) =>
            renderRow(
              row,
              row.rotationRole === "sixth_man" ? "6th" : String(i + 6),
            ),
          )}
        </ul>
      </div>
    </section>
  );
}
