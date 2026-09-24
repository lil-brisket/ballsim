"use client";

import type { RotationView } from "@/state/team-management-selectors";

export function RotationHealth(props: {
  rotation: RotationView;
  localTotalMinutes: number;
  localMeaningfulCount: number;
}) {
  const health = props.rotation.health;
  const balance =
    props.localTotalMinutes === props.rotation.target
      ? "Balanced"
      : props.localTotalMinutes > props.rotation.target
        ? "Over"
        : "Under";
  const overviewLine =
    health?.summaryLine ??
    `${props.localTotalMinutes} / ${props.rotation.target} MIN · ${props.localMeaningfulCount} Players · ${balance}`;
  const availabilitySummary =
    health?.availabilitySummary ??
    `${props.rotation.rows.filter((r) => r.availabilityStatus === "available").length} available`;

  const healthIssues =
    health?.issues ??
    props.rotation.feedback.map((item) => ({
      code: item.kind,
      message: item.message,
      severity:
        item.kind === "unavailable" ||
        item.kind === "too_many" ||
        item.kind === "not_enough" ||
        item.kind === "infeasible"
          ? ("error" as const)
          : ("warning" as const),
    }));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Rotation Health
      </h2>
      {props.rotation.feasibilityBanner ? (
        <div className="rounded-lg border border-rose-700 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {props.rotation.feasibilityBanner}
        </div>
      ) : null}
      <div
        className={`rounded-lg border p-4 ${
          health?.level === "invalid"
            ? "border-rose-800 bg-rose-950/20"
            : health?.level === "warning"
              ? "border-amber-800 bg-amber-950/20"
              : "border-zinc-800 bg-zinc-900/50"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-zinc-100">{overviewLine}</p>
          <p className="text-xs text-zinc-400">{availabilitySummary}</p>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Draft minutes: {props.localTotalMinutes} / {props.rotation.target} ·{" "}
          {props.localMeaningfulCount} with minutes
        </p>
        {healthIssues.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs">
            {healthIssues.map((issue) => (
              <li
                key={`${issue.code}-${issue.message}`}
                className={
                  issue.severity === "error"
                    ? "text-rose-300"
                    : "text-amber-300"
                }
              >
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-emerald-400">
            Rotation looks healthy.
          </p>
        )}
        {health?.workloadWarnings && health.workloadWarnings.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-orange-300">
            {health.workloadWarnings.map((warning) => (
              <li key={warning.playerId}>
                ⚠️ {warning.playerName}: {warning.reason}
                {warning.overridden ? " (overridden)" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
