import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { panelClass } from "@/components/ui/styles";
import type {
  CheckResult,
  ValidationVerdict,
} from "@/simulation/validation/types";
import type { LabFailure, LabReport } from "@/simulation/lab/types";
import { formatFixed, formatPct } from "@/components/dev/sim-lab/format";

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
      <h3 className="text-sm font-medium text-zinc-200">{props.title}</h3>
      {props.items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">None</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {props.items.map((item, index) => (
            <li
              key={`${item.rule}-${index}`}
              className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
            >
              <p className="font-mono text-amber-300">
                {item.rule} [{item.scope}]
              </p>
              <p className="mt-1 text-zinc-300">{item.detail}</p>
              <p className="mt-1 font-mono text-xs text-zinc-500">
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
    <li className="flex items-start justify-between gap-3 border-b border-zinc-800 py-2 last:border-b-0">
      <div>
        <p className="text-sm text-zinc-200">{props.check.name}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{props.check.message}</p>
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

      <p className="font-mono text-xs text-zinc-500">
        checksum={props.report.checksum} · nightly=
        {props.channelExitNightly === 0 ? "pass" : "fail"} ·{" "}
        {props.report.reproCommand}
      </p>

      <div className={panelClass + " p-4"}>
        <h3 className="text-sm font-medium text-zinc-200">
          Statistical checks
        </h3>
        {props.report.statChecks.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">None (low game count)</p>
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
