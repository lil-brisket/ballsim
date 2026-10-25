import { setDevelopmentFocusesAction } from "@/application/actions";
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
 * Training camps: the camp catalogue plus one form that assigns a camp to
 * every player on the roster.
 */
export function TrainingCamps(props: {
  saveId: string;
  returnPath: string;
  plans: DevelopmentPlansView;
}) {
  const { saveId, returnPath, plans } = props;
  return (
    <Section title="Training camps">
      <p className="mb-3 text-sm text-zinc-400">
        Camps run at the end of the season. A camp channels a player&apos;s
        growth into its skills and shields them from decline; it reshapes
        development, it does not add any.
      </p>
      <ul className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {plans.camps.map((camp) => (
          <li
            key={camp.focus}
            className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
          >
            <p className="flex items-baseline justify-between gap-2 text-sm font-medium text-zinc-100">
              <span className="truncate">{camp.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-400">
                {camp.attendees}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {camp.skills.join(", ")}
            </p>
          </li>
        ))}
      </ul>
      {plans.rows.length === 0 ? (
        <EmptyState message="No players on the roster." />
      ) : (
        <form action={setDevelopmentFocusesAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <ul className="divide-y divide-zinc-800">
            {plans.rows.map((row) => (
              <li
                key={row.playerId}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2"
              >
                <div className="min-w-0">
                  <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
                    {row.playerName}
                  </PlayerEntityLink>
                  <span className="ml-2 text-sm text-zinc-500">
                    {row.position} · {row.age}
                  </span>
                  <span className="ml-2 text-sm tabular-nums text-zinc-300">
                    OVR {row.overall}
                  </span>
                  {row.injury ? (
                    <span className="ml-2 rounded-full border border-orange-400/40 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-300">
                      Injured · {row.injury.label}
                    </span>
                  ) : null}
                </div>
                <div>
                  <label className="sr-only" htmlFor={`camp-${row.playerId}`}>
                    Camp for {row.playerName}
                  </label>
                  <select
                    id={`camp-${row.playerId}`}
                    name={`camp:${row.playerId}`}
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
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button type="submit" variant="secondary" className="min-h-9">
              Save camps
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
