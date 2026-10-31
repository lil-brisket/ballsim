"use client";

import Link from "next/link";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { PlayerActionMenu } from "@/components/roster/PlayerActionMenu";
import { OvrRing } from "@/components/roster/sheet/OvrRing";
import { RatingCell } from "@/components/roster/sheet/RatingCell";
import { Button, buttonClass } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/components/ui/styles";
import type { RatingDisplayMode } from "@/presentation/rating-grade";
import {
  SHEET_SKILL_COLUMNS,
  toRosterSheetRow,
} from "@/presentation/roster-sheet-columns";
import type { SheetPlayerView } from "@/state/roster-sheet-view";

const STRENGTH_COUNT = 3;

/** The player's best skill areas, highest first (list order breaks ties). */
export function topStrengths(player: SheetPlayerView) {
  const row = toRosterSheetRow(player);
  return SHEET_SKILL_COLUMNS.map((column, index) => ({
    key: column.key,
    long: column.long,
    value: row[column.key],
    index,
  }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .slice(0, STRENGTH_COUNT);
}

/**
 * The selected player's summary above the sheet. The name and overall sit in
 * a polite live region so arrow-key selection is announced.
 */
export function SheetHeader(props: {
  saveId: string;
  player: SheetPlayerView;
  returnPath: string;
  mode: RatingDisplayMode;
  variant?: "roster" | "market";
  /** Where the market variant's "View in Free Agency" link goes. */
  marketHref?: string;
}) {
  const { player } = props;
  const { openPlayer } = useEntityDrawer();
  const name = `${player.firstName} ${player.lastName}`;
  const strengths = topStrengths(player);
  const market = props.variant === "market";

  return (
    <section
      aria-label="Selected player"
      className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-surface-line pb-3"
    >
      <div aria-live="polite" className="flex min-w-0 items-center gap-3">
        <PlayerPortrait
          playerId={player.playerId}
          portrait={player.portrait}
          firstName={player.firstName}
          lastName={player.lastName}
          size="md"
        />
        <div className="min-w-0">
          <SectionHeading
            as="h3"
            size="display"
            title={name}
            titleClassName="truncate text-2xl font-bold leading-tight text-ink sm:text-3xl"
          />
          <p className="text-sm text-muted">
            <span className="font-mono tabular-nums">
              #{player.jerseyNumber}
            </span>{" "}
            · {player.position}
          </p>
          <p className="hidden font-display text-lg uppercase tracking-wide text-soft sm:block">
            {player.archetypeLabel}
          </p>
        </div>
        <OvrRing overall={player.overall} size="md" />
      </div>

      <div className="hidden min-w-0 flex-1 sm:block">
        <SectionHeading as="h4" size="xs" title="Strengths" />
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
          {strengths.map((strength) => (
            <li key={strength.key} className="flex items-center gap-1.5">
              <span>{strength.long}</span>
              <RatingCell value={strength.value} mode={props.mode} />
            </li>
          ))}
        </ul>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <div className="text-right text-sm">
          {market ? (
            <p className="font-semibold text-ink">Free agent</p>
          ) : (
            <>
              <p className="font-semibold tabular-nums text-ink">
                {player.contractSalary != null
                  ? formatMoney(player.contractSalary)
                  : "—"}
              </p>
              <p className="text-muted">
                {player.contractYearsRemaining != null
                  ? `${player.contractYearsRemaining} ${
                      player.contractYearsRemaining === 1 ? "year" : "years"
                    } left`
                  : "No contract"}
              </p>
            </>
          )}
        </div>
        <StatusBadge
          label={player.availabilityLabel}
          tone={player.canPlay ? "available" : player.injuryKind}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => openPlayer(player.playerId)}
          >
            Open card
          </Button>
          {market ? (
            props.marketHref ? (
              <Link
                href={props.marketHref}
                className={cn(buttonClass({ variant: "quiet" }))}
              >
                View in Free Agency
              </Link>
            ) : null
          ) : (
            <>
              <Link
                href={`/dashboard/${props.saveId}/team/contracts`}
                className={cn(buttonClass({ variant: "quiet" }))}
              >
                Contracts
              </Link>
              <PlayerActionMenu
                saveId={props.saveId}
                playerId={player.playerId}
                playerName={name}
                onTradeBlock={player.onTradeBlock ?? false}
                returnPath={props.returnPath}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
