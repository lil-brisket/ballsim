import type { ScoutingReportView } from "@/systems/scouting/scouting-reports";

type Props = {
  playerName: string;
  report: ScoutingReportView;
  funFact?: string | null;
  interviewQuotes?: string[];
  onClose?: () => void;
};

export function ScoutingReportPanel({
  playerName,
  report,
  funFact,
  interviewQuotes,
  onClose,
}: Props) {
  return (
    <div className="rounded-xl border border-amber-800/40 bg-zinc-950 p-4 shadow-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{playerName}</h2>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Scouting report · {report.knowledgeLevel}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Close
          </button>
        ) : null}
      </div>

      {report.knowledgeLevel === "unknown" ? (
        <p className="text-sm text-zinc-500">
          Insufficient scouting. Assign scouts or advance days to learn more.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Scout Grade" value={report.scoutGrade ?? "—"} />
            <Stat
              label="Est. OVR"
              value={
                report.estimatedOverall
                  ? `${report.estimatedOverall.min}–${report.estimatedOverall.max}`
                  : "—"
              }
            />
            <Stat
              label="Potential"
              value={
                report.estimatedPotential
                  ? `${report.estimatedPotential.min}–${report.estimatedPotential.max}`
                  : "—"
              }
            />
            <Stat
              label="Confidence"
              value={report.confidence ?? "—"}
              capitalize
            />
          </div>

          {report.projectedRank ? (
            <p className="text-zinc-400">
              Projected rank: {report.projectedRank.min}–
              {report.projectedRank.max}
              {report.positionEstimate
                ? ` · ${report.positionEstimate}`
                : ""}
            </p>
          ) : null}

          {Object.keys(report.categories).length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-medium uppercase text-zinc-500">
                Categories
              </h3>
              <ul className="grid grid-cols-2 gap-1 text-xs text-zinc-300">
                {Object.entries(report.categories).map(([key, range]) =>
                  range ? (
                    <li key={key}>
                      {key}: {range.min}–{range.max}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          ) : null}

          {(report.strengths.length > 0 || report.weaknesses.length > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase text-emerald-500/80">
                  Strengths
                </h3>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">
                  {report.strengths.map((s) => (
                    <li key={s.label}>{s.label}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs uppercase text-rose-500/80">
                  Weaknesses
                </h3>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">
                  {report.weaknesses.map((w) => (
                    <li key={w.label}>{w.label}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {Object.keys(report.intangibles).length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs uppercase text-zinc-500">
                Intangibles
              </h3>
              <ul className="grid grid-cols-2 gap-1 text-xs text-zinc-300">
                {Object.entries(report.intangibles).map(([key, range]) =>
                  range ? (
                    <li key={key}>
                      {key}: {range.min}–{range.max}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          ) : null}

          {interviewQuotes && interviewQuotes.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs uppercase text-zinc-500">
                Interview notes
              </h3>
              <ul className="space-y-1 text-xs italic text-zinc-400">
                {interviewQuotes.map((q) => (
                  <li key={q}>&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
            </div>
          ) : null}

          {funFact ? (
            <p className="border-t border-zinc-800 pt-2 text-xs italic text-zinc-500">
              {funFact}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-800 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </div>
      <div
        className={`text-zinc-100 ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
