import Link from "next/link";
import {
  formatContractSummary,
  PlayerIdentityLine,
} from "@/components/basketball/PlayerIdentityLine";
import { CompareValue } from "@/components/player-compare/CompareValue";
import { RatingDisplaySwitch } from "@/components/ui/RatingDisplaySwitch";
import { PlayerComparePicker } from "@/components/player-compare/PlayerComparePicker";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { cn, displayClass } from "@/components/ui/styles";
import {
  buildCompareRows,
  deltaTone,
  formatDelta,
  type CompareRow,
} from "@/presentation/player-compare";
import { ratingTier } from "@/presentation/rating-tier";
import type { PlayerCompareView } from "@/state/player-compare";
import { SectionHeading } from "@/components/ui/SectionHeading";

const TONE_CLASS = {
  win: "text-win",
  loss: "text-loss",
  neutral: "text-muted",
} as const;

function SlotCard(props: {
  saveId: string;
  slot: "a" | "b";
  slotLabel: string;
  player: PlayerCompareView | null;
  otherId: string | null;
}) {
  const { player } = props;
  if (!player) {
    return (
      <section
        aria-label={props.slotLabel}
        data-slot={props.slot}
        data-empty
        className="flex min-h-40 flex-col justify-center gap-3 rounded-xl border border-dashed border-line bg-surface-raised/30 p-4"
      >
        <p className={cn(displayClass, "text-xl text-ink")}>Choose a player</p>
        <PlayerComparePicker
          key={`${props.slot}-empty`}
          saveId={props.saveId}
          slot={props.slot}
          otherId={props.otherId}
          slotLabel={props.slotLabel}
          empty
        />
      </section>
    );
  }
  return (
    <section
      aria-label={props.slotLabel}
      data-slot={props.slot}
      data-tier={ratingTier(player.overall).id}
      className="flex flex-col gap-3 rounded-xl border border-line border-l-4 border-l-tier bg-surface-raised/60 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionHeading
            as="h2"
            size="display"
            titleClassName="truncate text-2xl font-extrabold leading-tight text-ink"
            title={
              <Link
                href={`/dashboard/${props.saveId}/players/${player.playerId}`}
                className="hover:text-team-ink"
              >
                {player.firstName} {player.lastName}
              </Link>
            }
          />
          <p className={cn(displayClass, "mt-1 truncate text-base text-soft")}>
            {player.archetypeLabel}
          </p>
          <PlayerIdentityLine
            className="mt-1"
            lead={player.teamAbbreviation ?? "FA"}
            position={player.position}
            age={player.age}
            heightInches={player.heightInches}
            contractSummary={formatContractSummary(player.contract)}
          />
        </div>
        <OvrBadge overall={player.overall} size="lg" />
      </div>
      <div>
        <PlayerComparePicker
          key={player.playerId}
          saveId={props.saveId}
          slot={props.slot}
          otherId={props.otherId}
          slotLabel={props.slotLabel}
        />
      </div>
    </section>
  );
}

function Row(props: { row: CompareRow }) {
  const { row } = props;
  const tone = deltaTone(row.delta);
  const major = row.kind !== "attribute";
  const valueClass = cn(
    "py-2 text-right tabular-nums",
    major ? "font-display text-2xl font-bold text-ink" : "text-sm text-soft",
  );
  return (
    <tr
      data-row-kind={row.kind}
      className={cn(
        "border-t border-line",
        row.kind === "group" && "bg-surface-deep/40",
      )}
    >
      <th
        scope="row"
        className={cn(
          "py-2 pr-3 text-left font-normal",
          major ? "text-base font-semibold text-ink" : "pl-4 text-sm text-soft",
        )}
      >
        {row.label}
      </th>
      <td className={valueClass}>
        {row.kind === "overall" ? row.a : <CompareValue value={row.a} />}
      </td>
      <td className={valueClass}>
        {row.kind === "overall" ? row.b : <CompareValue value={row.b} />}
      </td>
      <td
        data-tone={tone}
        className={cn(
          "py-2 pl-3 text-right text-sm font-semibold tabular-nums",
          TONE_CLASS[tone],
        )}
      >
        {formatDelta(row.delta)}
      </td>
    </tr>
  );
}

/**
 * Two player cards side by side, then one table with both values and the
 * signed difference (second player minus first) for OVR, each attribute group
 * and each attribute. An empty slot shows a picker prompt.
 */
export function PlayerCompareBoard(props: {
  saveId: string;
  a: PlayerCompareView | null;
  b: PlayerCompareView | null;
}) {
  const { a, b } = props;
  const rows = a && b ? buildCompareRows(a, b) : null;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SlotCard
          saveId={props.saveId}
          slot="a"
          slotLabel="First player"
          player={a}
          otherId={b?.playerId ?? null}
        />
        <SlotCard
          saveId={props.saveId}
          slot="b"
          slotLabel="Second player"
          player={b}
          otherId={a?.playerId ?? null}
        />
      </div>
      {a && b && rows ? (
        <div className="space-y-3">
          <RatingDisplaySwitch />
          <table className="w-full max-w-3xl border-collapse">
            <caption className="sr-only">
              Ratings for {a.firstName} {a.lastName} and {b.firstName}{" "}
              {b.lastName}, with the difference
            </caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 text-left text-sm text-muted">
                  Rating
                </th>
                <th
                  scope="col"
                  className="max-w-24 truncate py-2 text-right text-sm text-muted"
                >
                  {a.lastName}
                </th>
                <th
                  scope="col"
                  className="max-w-24 truncate py-2 text-right text-sm text-muted"
                >
                  {b.lastName}
                </th>
                <th
                  scope="col"
                  className="py-2 pl-3 text-right text-sm text-muted"
                >
                  Diff
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.key} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Pick two players to compare their ratings.
        </p>
      )}
    </div>
  );
}
