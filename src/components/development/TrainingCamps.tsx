import { setDevelopmentFocusesAction } from "@/application/actions";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/styles";
import { DEVELOPMENT_FOCUSES } from "@/domain/entities/development-plan";
import {
  DEVELOPMENT_FOCUS_LABELS,
  type DevelopmentPlansView,
} from "@/state/development-plan-selectors";
import { OvrBadge } from "@/components/ui/OvrBadge";

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
      <p className="mb-1 text-sm text-muted">
        Camps run at the end of the season and add growth to the camp&apos;s
        skills, for players of any age. A camp never lowers a rating, and no
        player grows past their potential.
      </p>
      <p className="mb-3 text-sm text-soft">
        Camp spots:{" "}
        <span
          className={cn(
            "tabular-nums",
            plans.booked >= plans.slots ? "text-warning" : "text-ink",
          )}
        >
          {plans.booked} / {plans.slots}
        </span>{" "}
        <span className="text-faint">
          (set by your trainer; a better trainer runs more)
        </span>
      </p>
      <ul className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {plans.camps.map((camp) => (
          <li
            key={camp.focus}
            className="min-w-0 rounded-lg border border-line bg-surface-raised/40 px-3 py-2"
          >
            <p className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
              <span className="truncate">{camp.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {camp.attendees}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-faint">
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
          <ul className="divide-y divide-line">
            {plans.rows.map((row) => (
              <li
                key={row.playerId}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2"
              >
                <div className="min-w-0">
                  <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
                    {row.playerName}
                  </PlayerEntityLink>
                  <span className="ml-2 text-sm text-faint">
                    {row.position} · {row.age}
                  </span>
                  <OvrBadge
                    overall={row.overall}
                    size="sm"
                    className="ml-2 align-middle"
                  />
                  {row.injury ? (
                    <span className="ml-2 rounded-full border border-caution/40 bg-caution/10 px-2 py-0.5 text-xs text-caution-ink">
                      Injured · {row.injury.label}
                    </span>
                  ) : null}
                </div>
                <div>
                  <label className="sr-only" htmlFor={`camp-${row.playerId}`}>
                    Camp for {row.playerName}
                  </label>
                  <Select
                    id={`camp-${row.playerId}`}
                    name={`camp:${row.playerId}`}
                    defaultValue={row.focus}
                  >
                    {DEVELOPMENT_FOCUSES.map((focus) => (
                      <option key={focus} value={focus}>
                        {DEVELOPMENT_FOCUS_LABELS[focus]}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button type="submit" variant="secondary" className="min-h-11">
              Save camps
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
