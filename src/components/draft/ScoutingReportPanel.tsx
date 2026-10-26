import { buttonClass } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
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
    <div className="rounded-xl border border-team-ink/50 bg-surface-base p-4 shadow-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <SectionHeading title={playerName} />
          <p className="text-sm text-faint">
            Scouting report · {report.knowledgeLevel}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={buttonClass({ variant: "quiet" })}
          >
            Close
          </button>
        ) : null}
      </div>

      {report.knowledgeLevel === "unknown" ? (
        <p className="text-sm text-faint">
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
            <p className="text-muted">
              Projected rank: {report.projectedRank.min}–
              {report.projectedRank.max}
              {report.positionEstimate ? ` · ${report.positionEstimate}` : ""}
            </p>
          ) : null}

          {Object.keys(report.categories).length > 0 ? (
            <div>
              <SectionHeading
                as="h3"
                size="sm"
                tone="soft"
                className="mb-1"
                title="Categories"
              />
              <ul className="grid grid-cols-2 gap-1 text-sm text-soft">
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
                <SectionHeading
                  as="h3"
                  size="sm"
                  tone="win"
                  title="Strengths"
                />
                <ul className="mt-1 space-y-0.5 text-sm text-soft">
                  {report.strengths.map((s) => (
                    <li key={s.label}>{s.label}</li>
                  ))}
                </ul>
              </div>
              <div>
                <SectionHeading
                  as="h3"
                  size="sm"
                  tone="loss"
                  title="Weaknesses"
                />
                <ul className="mt-1 space-y-0.5 text-sm text-soft">
                  {report.weaknesses.map((w) => (
                    <li key={w.label}>{w.label}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {Object.keys(report.intangibles).length > 0 ? (
            <div>
              <SectionHeading
                as="h3"
                size="sm"
                tone="soft"
                className="mb-1"
                title="Intangibles"
              />
              <ul className="grid grid-cols-2 gap-1 text-sm text-soft">
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
              <SectionHeading
                as="h3"
                size="sm"
                tone="soft"
                className="mb-1"
                title="Interview notes"
              />
              <ul className="space-y-1 text-sm italic text-muted">
                {interviewQuotes.map((q) => (
                  <li key={q}>&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
            </div>
          ) : null}

          {funFact ? (
            <p className="border-t border-line pt-2 text-sm italic text-faint">
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
    <div className="rounded-md border border-line px-2 py-1.5">
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-ink ${capitalize ? "capitalize" : ""}`}>
        {value}
      </div>
    </div>
  );
}
