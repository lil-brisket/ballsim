import {
  assignToDevelopmentLeagueAction,
  recallFromDevelopmentLeagueAction,
} from "@/application/actions";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { StatusBadge } from "@/components/owner/StatusBadge";
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

export function DlProspectRow(props: {
  saveId: string;
  row: DlProspectRowView;
  returnPath: string;
  showRecall?: boolean;
}) {
  const { saveId, row, returnPath, showRecall = true } = props;
  return (
    <tr className="border-t border-zinc-800 text-zinc-200">
      <td className="px-3 py-2">
        <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
          {row.name}
        </PlayerEntityLink>
        <p className="text-xs text-zinc-500">Age {row.age}</p>
      </td>
      <td className="px-3 py-2">{row.overall}</td>
      <td className="px-3 py-2">{row.potential}</td>
      <td className="px-3 py-2 text-zinc-400">
        {row.dlSeason}/3 ({row.seasonsRemaining} left)
      </td>
      <td className="px-3 py-2">{row.mpg ?? "—"}</td>
      <td className="px-3 py-2">
        {row.ppg !== null ? row.ppg.toFixed(1) : "—"}
      </td>
      <td className="px-3 py-2">
        <StatusBadge
          label={readinessLabel(row.readiness)}
          tone={readinessTone(row.readiness)}
        />
      </td>
      <td className="px-3 py-2 text-xs text-zinc-400">
        <ul className="list-disc pl-4">
          {row.whyBullets.slice(0, 2).map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </td>
      <td className="px-3 py-2">
        {showRecall ? (
          <form action={recallFromDevelopmentLeagueAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="playerId" value={row.playerId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-100 hover:border-amber-500"
            >
              Recall
            </button>
          </form>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        )}
      </td>
    </tr>
  );
}

export function DlEligibleRow(props: {
  saveId: string;
  row: {
    playerId: string;
    name: string;
    overall: number;
    potential: number;
    projectedMpg: number;
    strongCandidate: boolean;
  };
  returnPath: string;
}) {
  const { saveId, row, returnPath } = props;
  return (
    <tr className="border-t border-zinc-800 text-zinc-200">
      <td className="px-3 py-2">
        <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
          {row.name}
        </PlayerEntityLink>
      </td>
      <td className="px-3 py-2">{row.overall}</td>
      <td className="px-3 py-2">{row.potential}</td>
      <td className="px-3 py-2">{row.projectedMpg}</td>
      <td className="px-3 py-2 text-xs text-zinc-400">
        {row.strongCandidate ? "Strong DL candidate" : "Optional"}
      </td>
      <td className="px-3 py-2">
        <form action={assignToDevelopmentLeagueAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="playerId" value={row.playerId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className="rounded border border-amber-600 bg-amber-950/40 px-2 py-1 text-xs text-amber-200 hover:bg-amber-900/50"
          >
            Assign
          </button>
        </form>
      </td>
    </tr>
  );
}
