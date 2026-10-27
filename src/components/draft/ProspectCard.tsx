"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";

type ProspectCardProps = {
  saveId: string;
  playerId: string;
  firstName: string;
  lastName: string;
  /** Persisted portrait from the view model; null/absent → initials plate. */
  portrait?: PlayerPortraitAssignment | null;
  position: string;
  age?: number | null;
  nationality?: string | null;
  scoutGrade: string | null;
  estimatedOverallMin: number | null;
  estimatedOverallMax: number | null;
  confidence: string | null;
  projectedPick?: number | null;
  previousProjectedPick?: number | null;
  funFact?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  onBoard?: boolean;
};

export function ProspectCard(props: ProspectCardProps) {
  const delta =
    props.projectedPick != null && props.previousProjectedPick != null
      ? props.previousProjectedPick - props.projectedPick
      : null;

  return (
    <article className="rounded-lg border border-line bg-surface-base/60 p-3 text-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <PlayerPortrait
            playerId={props.playerId}
            firstName={props.firstName}
            lastName={props.lastName}
            portrait={props.portrait}
            size="sm"
          />
          <div className="min-w-0">
            <SectionHeading
              as="h3"
              size="sm"
              title={
                <>
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={props.playerId}
                  >
                    {props.firstName} {props.lastName}
                  </PlayerEntityLink>
                </>
              }
            />
            <p className="text-sm text-faint">
              {props.position}
              {props.age != null ? ` · Age ${props.age}` : ""}
              {props.nationality ? ` · ${props.nationality}` : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-team-ink">
            {props.scoutGrade ?? "—"}
          </div>
          <div className="text-sm text-faint">Scout Grade</div>
        </div>
      </header>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted">
        <div>
          <dt className="text-disabled">Est. OVR</dt>
          <dd className="text-ink">
            {props.estimatedOverallMin != null &&
            props.estimatedOverallMax != null
              ? `${props.estimatedOverallMin}–${props.estimatedOverallMax}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-disabled">Confidence</dt>
          <dd className="capitalize text-ink">{props.confidence ?? "—"}</dd>
        </div>
        {props.projectedPick != null && props.projectedPick < 900 ? (
          <div className="col-span-2">
            <dt className="text-disabled">Projected</dt>
            <dd className="text-ink">
              #{props.projectedPick}
              {delta != null && delta !== 0 ? (
                <span
                  className={delta > 0 ? "ml-2 text-win" : "ml-2 text-loss"}
                >
                  {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      {props.strengths?.length || props.weaknesses?.length ? (
        <div className="mt-2 space-y-1 text-sm">
          {props.strengths?.slice(0, 2).map((s) => (
            <p key={s} className="text-win">
              + {s}
            </p>
          ))}
          {props.weaknesses?.slice(0, 2).map((w) => (
            <p key={w} className="text-loss">
              − {w}
            </p>
          ))}
        </div>
      ) : null}

      {props.funFact ? (
        <p className="mt-2 border-t border-line pt-2 text-sm italic text-faint">
          {props.funFact}
        </p>
      ) : null}

      {props.onBoard ? (
        <p className="mt-1 text-sm text-team-ink/80">On draft board</p>
      ) : null}
    </article>
  );
}
