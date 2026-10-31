import { buttonClass } from "@/components/ui/Button";
import {
  assignToDevelopmentLeagueAction,
  recallFromDevelopmentLeagueAction,
} from "@/application/actions";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { StatLine } from "@/components/basketball/StatLine";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { splitDisplayName } from "@/presentation/portrait-hash";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, densityPadding, panelClass } from "@/components/ui/styles";
import { DL_MAX_SEASONS } from "@/domain/entities/development-league";
import type { DlProspectRowView } from "@/state/development-league-selectors";
import { OvrBadge } from "@/components/ui/OvrBadge";

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
        className="font-mono text-faint"
        aria-label="No season-over-season history"
      >
        —
      </span>
    );
  }
  if (props.delta === 0) {
    return <span className="font-mono text-muted">0</span>;
  }
  if (props.delta > 0) {
    return (
      <span className="font-mono font-semibold text-success-ink">
        +{props.delta}
      </span>
    );
  }
  return (
    <span className="font-mono font-semibold text-danger-ink">
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
      <button type="submit" className={buttonClass({ variant: "secondary" })}>
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
  const nameParts = splitDisplayName(row.name);

  return (
    <article
      className={cn(
        panelClass,
        densityPadding.default,
        ready && "border-success/50",
        row.readiness === "near_ready" && "border-warning/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <PlayerPortrait
            playerId={row.playerId}
            portrait={row.portrait}
            firstName={nameParts.firstName}
            lastName={nameParts.lastName}
            size="sm"
          />
          <div className="min-w-0">
            <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
              {row.name}
            </PlayerEntityLink>
            <p className="mt-0.5 text-sm text-faint">
              Age {row.age} · {row.role}
            </p>
          </div>
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
          <p className="text-sm text-muted">OVR</p>
          <OvrBadge overall={row.overall} size="md" />
        </div>
        <div>
          <p className="text-sm text-muted">Change</p>
          <div className="mt-0.5">
            <ChangeDelta delta={row.changeDelta} />
          </div>
          {row.changeLabel ? (
            <p className="text-sm text-disabled">{row.changeLabel}</p>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-muted">POT</p>
          <OvrBadge overall={row.potential} ghost label="POT" size="sm" />
          <p className="text-sm text-disabled">
            {row.potentialHeadroom === 0
              ? "At ceiling"
              : `${row.potentialHeadroom} headroom`}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-sm text-faint">
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

      <p className="mt-3 text-sm text-faint">{row.whyBullets[0]}</p>
    </article>
  );
}

type EligibleRowData = {
  playerId: string;
  portrait?: PlayerPortraitAssignment | null;
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
      <button type="submit" className={buttonClass({ variant: "primary" })}>
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
  const nameParts = splitDisplayName(row.name);
  return (
    <article className={cn(panelClass, densityPadding.compact, "text-muted")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <PlayerPortrait
            playerId={row.playerId}
            portrait={row.portrait}
            firstName={nameParts.firstName}
            lastName={nameParts.lastName}
            size="sm"
          />
          <div>
            <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
              {row.name}
            </PlayerEntityLink>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-disabled">
              <OvrBadge overall={row.overall} size="sm" />
              <OvrBadge overall={row.potential} ghost label="POT" size="sm" />
              <span>{row.projectedMpg} proj. MPG</span>
            </p>
            <p className="mt-1 text-sm text-faint">
              {row.strongCandidate ? "Strong DL candidate" : "Optional"}
            </p>
          </div>
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
  const nameParts = splitDisplayName(row.name);
  return (
    <tr className="border-t border-line text-muted">
      <td className="px-3 py-2">
        <span className="flex items-center gap-2">
          <PlayerPortrait
            playerId={row.playerId}
            portrait={row.portrait}
            firstName={nameParts.firstName}
            lastName={nameParts.lastName}
            size="sm"
          />
          <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
            {row.name}
          </PlayerEntityLink>
        </span>
      </td>
      <td className="px-3 py-2">
        <OvrBadge overall={row.overall} size="sm" className="align-middle" />
      </td>
      <td className="px-3 py-2">
        <OvrBadge
          overall={row.potential}
          ghost
          label="POT"
          size="sm"
          className="align-middle"
        />
      </td>
      <td className="px-3 py-2 text-sm">
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
