import Link from "next/link";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import { splitDisplayName } from "@/presentation/portrait-hash";
import {
  DEVELOPMENT_FOCUS_LABELS,
  TRAINING_CAMPS,
  type SkillRatingsRow,
} from "@/state/development-plan-selectors";
import { OvrBadge } from "@/components/ui/OvrBadge";

const HEADERS = [
  "Player",
  "OVR",
  ...TRAINING_CAMPS.map((focus) => DEVELOPMENT_FOCUS_LABELS[focus]),
  "POT",
  "DL",
];

function Delta(props: { delta: number | null; injured: boolean }) {
  const { delta, injured } = props;
  if (delta === null || delta === 0) return null;
  const gain = delta > 0;
  return (
    <span
      className={cn(
        "ml-1 text-xs",
        gain
          ? "text-success-ink"
          : injured
            ? "text-caution-ink"
            : "text-danger-ink",
      )}
    >
      {gain ? `+${delta}` : `−${Math.abs(delta)}`}
    </span>
  );
}

/** Skill ratings by camp area with the change since last season. */
export function SkillRatingsTable(props: {
  saveId: string;
  rows: SkillRatingsRow[];
}) {
  const { saveId, rows } = props;
  return (
    <Section title="Skill ratings">
      <p className="mb-3 text-sm text-muted">
        Change since last season:{" "}
        <span className="text-success-ink">green</span> improved,{" "}
        <span className="text-danger-ink">red</span> declined,{" "}
        <span className="text-caution-ink">amber</span> declined while injured.
      </p>
      {rows.length === 0 ? (
        <EmptyState message="No players on the roster." />
      ) : (
        <DataTable headers={HEADERS}>
          {rows.map((row) => {
            const injured = row.injury !== null;
            const nameParts = splitDisplayName(row.playerName);
            return (
              <tr key={row.playerId}>
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
                      {row.playerName}
                    </PlayerEntityLink>
                  </span>
                  <p className="text-sm text-faint">
                    {row.position} · {row.age}
                  </p>
                  {row.focus !== "balanced" ? (
                    <p className="text-xs text-faint">
                      {DEVELOPMENT_FOCUS_LABELS[row.focus]} camp
                    </p>
                  ) : null}
                  {row.injury ? (
                    <span className="mt-0.5 inline-block rounded-full border border-caution/40 bg-caution/10 px-2 py-0.5 text-xs text-caution-ink">
                      Injured · {row.injury.label}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <OvrBadge overall={row.overall} size="sm" />
                    <Delta delta={row.overallDelta} injured={injured} />
                  </span>
                </td>
                {row.skills.map((skill) => (
                  <td
                    key={skill.focus}
                    className="whitespace-nowrap px-3 py-2 tabular-nums text-soft"
                  >
                    {skill.rating}
                    <Delta delta={skill.delta} injured={injured} />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <OvrBadge
                    overall={row.potential}
                    ghost
                    label="POT"
                    size="sm"
                    className="align-middle"
                  />
                </td>
                <td className="px-3 py-2">
                  {row.onDevelopmentLeague ? (
                    <Link
                      href={`/dashboard/${saveId}/development-league`}
                      className={cn(linkClass, focusRingClass)}
                    >
                      Yes
                    </Link>
                  ) : (
                    <span className="text-sm text-disabled">No</span>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </Section>
  );
}
