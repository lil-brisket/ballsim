type ProspectCardProps = {
  playerId: string;
  firstName: string;
  lastName: string;
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
    <article className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-zinc-100">
            {props.firstName} {props.lastName}
          </h3>
          <p className="text-xs text-zinc-500">
            {props.position}
            {props.age != null ? ` · Age ${props.age}` : ""}
            {props.nationality ? ` · ${props.nationality}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-amber-300">
            {props.scoutGrade ?? "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            Scout Grade
          </div>
        </div>
      </header>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <div>
          <dt className="text-zinc-600">Est. OVR</dt>
          <dd className="text-zinc-200">
            {props.estimatedOverallMin != null &&
            props.estimatedOverallMax != null
              ? `${props.estimatedOverallMin}–${props.estimatedOverallMax}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Confidence</dt>
          <dd className="capitalize text-zinc-200">
            {props.confidence ?? "—"}
          </dd>
        </div>
        {props.projectedPick != null && props.projectedPick < 900 ? (
          <div className="col-span-2">
            <dt className="text-zinc-600">Projected</dt>
            <dd className="text-zinc-200">
              #{props.projectedPick}
              {delta != null && delta !== 0 ? (
                <span
                  className={
                    delta > 0 ? "ml-2 text-emerald-400" : "ml-2 text-rose-400"
                  }
                >
                  {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      {(props.strengths?.length || props.weaknesses?.length) ? (
        <div className="mt-2 space-y-1 text-xs">
          {props.strengths?.slice(0, 2).map((s) => (
            <p key={s} className="text-emerald-400/90">
              + {s}
            </p>
          ))}
          {props.weaknesses?.slice(0, 2).map((w) => (
            <p key={w} className="text-rose-400/90">
              − {w}
            </p>
          ))}
        </div>
      ) : null}

      {props.funFact ? (
        <p className="mt-2 border-t border-zinc-800 pt-2 text-xs italic text-zinc-500">
          {props.funFact}
        </p>
      ) : null}

      {props.onBoard ? (
        <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-500/80">
          On draft board
        </p>
      ) : null}
    </article>
  );
}
