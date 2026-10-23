import { setDevelopmentFocusAction } from "@/application/actions";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { cn, focusRingClass } from "@/components/ui/styles";
import { DEVELOPMENT_FOCUSES } from "@/domain/entities/development-plan";
import {
  DEVELOPMENT_FOCUS_LABELS,
  type DevelopmentPlansView,
} from "@/state/development-plan-selectors";

/**
 * Focus picker per young player plus last season's change by area.
 */
export function DevelopmentPlans(props: {
  saveId: string;
  returnPath: string;
  plans: DevelopmentPlansView;
}) {
  const { saveId, returnPath, plans } = props;
  return (
    <Section title="Development plans">
      <p className="mb-3 text-sm text-zinc-400">
        Players {plans.maxAge} and younger can focus their offseason work. A
        focus moves growth between areas; it does not add any.
      </p>
      {plans.rows.length === 0 ? (
        <EmptyState message={`No players ${plans.maxAge} or younger.`} />
      ) : (
        <ul className="divide-y divide-zinc-800">
          {plans.rows.map((row) => (
            <li
              key={row.playerId}
              className="flex flex-wrap items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
                  {row.playerName}
                </PlayerEntityLink>
                <span className="ml-2 text-sm text-zinc-500">{row.age}</span>
                {row.lastChange ? (
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-400">
                    {row.lastChange
                      .filter((area) => area.delta !== 0)
                      .map((area) => (
                        <span
                          key={area.label}
                          className={
                            area.delta > 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }
                        >
                          {area.label} {area.delta > 0 ? "+" : "−"}
                          {Math.abs(area.delta)}
                        </span>
                      ))}
                  </p>
                ) : null}
              </div>
              <form
                action={setDevelopmentFocusAction}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="playerId" value={row.playerId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <label className="sr-only" htmlFor={`focus-${row.playerId}`}>
                  Focus for {row.playerName}
                </label>
                <select
                  id={`focus-${row.playerId}`}
                  name="focus"
                  defaultValue={row.focus}
                  className={cn(
                    "min-h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100",
                    focusRingClass,
                  )}
                >
                  {DEVELOPMENT_FOCUSES.map((focus) => (
                    <option key={focus} value={focus}>
                      {DEVELOPMENT_FOCUS_LABELS[focus]}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="secondary" className="min-h-9">
                  Save
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
