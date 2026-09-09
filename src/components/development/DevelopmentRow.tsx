import Link from "next/link";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { cn } from "@/components/ui/styles";
import type { DevelopmentHubRow } from "@/state/development-hub-selectors";

function changeTone(
  delta: number | null,
): "success" | "critical" | "neutral" {
  if (delta === null) return "neutral";
  if (delta > 0) return "success";
  if (delta < 0) return "critical";
  return "neutral";
}

function formatChange(delta: number | null): string {
  if (delta === null) return "—";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

/**
 * Development row — Change is visually primary, not potential headroom.
 * Columns: Player → Stage → OVR → Change → POT → DL
 */
export function DevelopmentRow(props: {
  saveId: string;
  row: DevelopmentHubRow;
}) {
  const { saveId, row } = props;
  const notable =
    row.changeDelta !== null && Math.abs(row.changeDelta) >= 1;

  return (
    <tr className="border-t border-zinc-800">
      <td className="px-3 py-2">
        <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
          {row.playerName}
        </PlayerEntityLink>
        <p className="text-xs text-zinc-500">
          {row.position} · {row.age}
        </p>
      </td>
      <td className="px-3 py-2">
        <StatusBadge label={row.stage} tone="neutral" />
      </td>
      <td className="px-3 py-2 text-zinc-300">{row.overall}</td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "font-mono text-sm",
            notable && row.changeDelta !== null && row.changeDelta > 0
              ? "font-semibold text-emerald-300"
              : notable && row.changeDelta !== null && row.changeDelta < 0
                ? "font-semibold text-rose-300"
                : "text-zinc-400",
          )}
        >
          {formatChange(row.changeDelta)}
        </span>
        {row.changeLabel ? (
          <p className="text-[0.65rem] text-zinc-600">{row.changeLabel}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-zinc-400">{row.potential}</td>
      <td className="px-3 py-2">
        {row.onDevelopmentLeague ? (
          <Link
            href={`/dashboard/${saveId}/development-league`}
            className="text-xs text-amber-400 hover:underline"
          >
            Yes
          </Link>
        ) : (
          <span className="text-xs text-zinc-600">No</span>
        )}
      </td>
    </tr>
  );
}

export { changeTone, formatChange };
