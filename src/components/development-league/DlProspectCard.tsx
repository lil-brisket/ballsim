import {
  assignToDevelopmentLeagueAction,
  recallFromDevelopmentLeagueAction,
} from "@/application/actions";
import { StatLine } from "@/components/basketball/StatLine";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  cn,
  densityPadding,
  focusRingClass,
  panelClass,
} from "@/components/ui/styles";
import { DL_MAX_SEASONS } from "@/domain/entities/development-league";
import type { DlProspectRowView } from "@/state/development-league-selectors";

function readinessLabel(value: string): string {
  switch (value) {
    case "ready":
      return "Ready";
    case "near_ready":
      return "Near Ready";
    case "developing":
      return "Developing";
    default:
      return "Not Ready";
  }
}

function readinessTone(
  value: string,
): "success" | "warning" | "neutral" | "info" {
  if (value === "ready") return "success";
  if (value === "near_ready") return "warning";
  return "neutral";
}

export function ChangeDelta(props: { delta: number | null }) {
  if (props.delta === null) {
    return (
      <span
        className="font-mono text-zinc-500"
        aria-label="No season-over-season history"
      >
        —
      </span>
    );
  }
  if (props.delta === 0) {
    return <span className="font-mono text-zinc-400">0</span>;
  }
  if (props.delta > 0) {
    return (
      <span className="font-mono font-semibold text-emerald-300">
        +{props.delta}
      </span>
    );
  }
  return (
    <span className="font-mono font-semibold text-rose-300">
      −{Math.abs(props.delta)}
    </span>
  );
}

function RecallButton(props: {
  saveId: string;
  playerId: string;
  returnPath: string;
}) {
  return (
    <form action={recallFromDevelopmentLeagueAction}>
      <input type="hidden" name="saveId" value={props.saveId} />
      <input type="hidden" name="playerId" value={props.playerId} />
      <input type="hidden" name="returnPath" value={props.returnPath} />
      <button
        type="submit"
        className={cn(
          "rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-amber-500",
          focusRingClass,
        )}
      >
        Recall
      </button>
    </form>
  );
}

function formatStat(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function DlProspectCard(props: {
  saveId: string;
  row: DlProspectRowView;
  returnPath: string;
  showRecall?: boolean;
}) {
  const { saveId, row, returnPath, showRecall = true } = props;
  const showRecallControl = showRecall;
  const ready = row.readiness === "ready";

  return (
    <article
      className={cn(
        panelClass,
        densityPadding.default,
        ready && "border-emerald-800/60",
        row.readiness === "near_ready" && "border-amber-800/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
            {row.name}
          </PlayerEntityLink>
          <p className="mt-0.5 text-xs text-zinc-500">
            Age {row.age} · {row.role}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={readinessLabel(row.readiness)}
            tone={readinessTone(row.readiness)}
          />
          {showRecallControl ? (
            <RecallButton
              saveId={saveId}
              playerId={row.playerId}
              returnPath={returnPath}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500">
            OVR
          </p>
          <p className="font-mono text-lg text-zinc-50">{row.overall}</p>
        </div>
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500">
            Change
          </p>
          <div className="mt-0.5">
            <ChangeDelta delta={row.changeDelta} />
          </div>
          {row.changeLabel ? (
            <p className="text-[0.65rem] text-zinc-600">{row.changeLabel}</p>
          ) : null}
        </div>
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500">
            POT
          </p>
          <p className="font-mono text-zinc-300">{row.potential}</p>
          <p className="text-[0.65rem] text-zinc-600">
            {row.potentialHeadroom === 0
              ? "At ceiling"
              : `${row.potentialHeadroom} headroom`}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs text-zinc-500">
          Season {row.dlSeason} of {DL_MAX_SEASONS}
          {row.seasonsRemaining > 0
            ? ` · ${row.seasonsRemaining} left`
            : " · tenure complete"}
        </p>
        <ProgressBar
          value={row.dlSeason}
          max={DL_MAX_SEASONS}
          aria-label={`Development League tenure: ${row.dlSeason} of ${DL_MAX_SEASONS} seasons`}
        />
      </div>

      <StatLine
        className="mt-3"
        density="compact"
        items={[
          { label: "MPG", value: formatStat(row.mpg) },
          { label: "PPG", value: formatStat(row.ppg) },
          { label: "RPG", value: formatStat(row.rpg) },
          { label: "APG", value: formatStat(row.apg) },
        ]}
      />

      <p className="mt-3 text-xs text-zinc-500">{row.whyBullets[0]}</p>
    </article>
  );
}

type EligibleRowData = {
  playerId: string;
  name: string;
  overall: number;
  potential: number;
  projectedMpg: number;
  strongCandidate: boolean;
};

function AssignButton(props: {
  saveId: string;
  playerId: string;
  returnPath: string;
}) {
  return (
    <form action={assignToDevelopmentLeagueAction}>
      <input type="hidden" name="saveId" value={props.saveId} />
      <input type="hidden" name="playerId" value={props.playerId} />
      <input type="hidden" name="returnPath" value={props.returnPath} />
      <button
        type="submit"
        className={cn(
          "rounded border border-amber-600 bg-amber-950/40 px-2 py-1 text-xs text-amber-200 hover:bg-amber-900/50",
          focusRingClass,
        )}
      >
        Assign
      </button>
    </form>
  );
}

export function DlEligibleCard(props: {
  saveId: string;
  row: EligibleRowData;
  returnPath: string;
}) {
  const { saveId, row, returnPath } = props;
  return (
    <article
      className={cn(panelClass, densityPadding.compact, "text-zinc-400")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
            {row.name}
          </PlayerEntityLink>
          <p className="mt-0.5 text-xs text-zinc-600">
            OVR {row.overall} · POT {row.potential} · {row.projectedMpg} proj.
            MPG
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {row.strongCandidate ? "Strong DL candidate" : "Optional"}
          </p>
        </div>
        <AssignButton
          saveId={saveId}
          playerId={row.playerId}
          returnPath={returnPath}
        />
      </div>
    </article>
  );
}

export function DlEligibleRow(props: {
  saveId: string;
  row: EligibleRowData;
  returnPath: string;
}) {
  const { saveId, row, returnPath } = props;
  return (
    <tr className="border-t border-zinc-800 text-zinc-400">
      <td className="px-3 py-2">
        <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
          {row.name}
        </PlayerEntityLink>
      </td>
      <td className="px-3 py-2 font-mono text-zinc-300">{row.overall}</td>
      <td className="px-3 py-2 font-mono">{row.potential}</td>
      <td className="px-3 py-2 text-xs">
        {row.strongCandidate ? "Strong DL candidate" : "Optional"}
      </td>
      <td className="px-3 py-2">
        <AssignButton
          saveId={saveId}
          playerId={row.playerId}
          returnPath={returnPath}
        />
      </td>
    </tr>
  );
}
