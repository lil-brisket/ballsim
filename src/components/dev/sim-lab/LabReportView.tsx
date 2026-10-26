import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { panelClass } from "@/components/ui/styles";
import type {
  CheckResult,
  ValidationVerdict,
} from "@/simulation/validation/types";
import type { LabFailure, LabReport } from "@/simulation/lab/types";
import { formatFixed, formatPct } from "@/components/dev/sim-lab/format";
import { SectionHeading } from "@/components/ui/SectionHeading";

function verdictTone(verdict: ValidationVerdict): string {
  if (verdict === "PASS") {
    return "success";
  }
  if (verdict === "WARNING") {
    return "warning";
  }
  return "failed";
}

function FailureList(props: { title: string; items: LabFailure[] }) {
  return (
    <div className={panelClass + " p-4"}>
      <SectionHeading as="h3" title={props.title} />
      {props.items.length === 0 ? (
        <p className="mt-2 text-sm text-faint">None</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {props.items.map((item, index) => (
            <li
              key={`${item.rule}-${index}`}
              className="rounded-md border border-line bg-surface-base/60 px-3 py-2 text-sm"
            >
              <p className="font-mono text-team-ink">
                {item.rule} [{item.scope}]
              </p>
              <p className="mt-1 text-soft">{item.detail}</p>
              <p className="mt-1 font-mono text-sm text-faint">
                {item.reproCommand}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCheckRow(props: { check: CheckResult }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <div>
        <p className="text-sm text-ink">{props.check.name}</p>
        <p className="mt-0.5 text-sm text-faint">{props.check.message}</p>
      </div>
      <StatusBadge
        label={props.check.verdict}
        tone={verdictTone(props.check.verdict)}
      />
    </li>
  );
}

export function LabReportView(props: {
  report: LabReport;
  wallMs: number;
  channelExitPr: number;
  channelExitNightly: number;
}) {
  const aggregates = props.report.aggregates;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Games" value={props.report.gamesSimulated} mono />
        <StatCard
          label="Wall time"
          value={formatFixed(props.wallMs / 1000, 2) + "s"}
          mono
        />
        <StatCard
          label="Hard failures"
          value={props.report.hardFailures.length}
          mono
        />
        <StatCard
          label="PR channel"
          value={props.channelExitPr === 0 ? "pass" : "fail"}
        />
      </div>

      {aggregates ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Mean team points"
            value={formatFixed(aggregates.teamPoints.mean)}
            mono
          />
          <StatCard
            label="Pooled FG%"
            value={
              aggregates.pooledShooting.fieldGoalPct == null
                ? "—"
                : formatPct(aggregates.pooledShooting.fieldGoalPct)
            }
            mono
          />
          <StatCard
            label="PPP"
            value={formatFixed(aggregates.pointsPerPossession.mean)}
            mono
          />
          <StatCard
            label="Home win rate"
            value={formatPct(aggregates.homeAway.homeWinRate)}
            mono
          />
        </div>
      ) : null}

      <p className="font-mono text-sm text-faint">
        checksum={props.report.checksum} · nightly=
        {props.channelExitNightly === 0 ? "pass" : "fail"} ·{" "}
        {props.report.reproCommand}
      </p>

      <div className={panelClass + " p-4"}>
        <SectionHeading as="h3" title="Statistical checks" />
        {props.report.statChecks.length === 0 ? (
          <p className="mt-2 text-sm text-faint">None (low game count)</p>
        ) : (
          <ul className="mt-2">
            {props.report.statChecks.map((check) => (
              <StatCheckRow key={check.name} check={check} />
            ))}
          </ul>
        )}
      </div>

      <FailureList title="Hard failures" items={props.report.hardFailures} />
      <FailureList title="Warnings" items={props.report.warnings} />
    </div>
  );
}
