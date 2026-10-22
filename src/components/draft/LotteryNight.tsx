"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { prefersReducedMotion } from "@/components/ui/CountUp";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { cn } from "@/components/ui/styles";
import type { DraftLotteryView } from "@/state/draft-lottery-selectors";

const REVEAL_INTERVAL_MS = 1200;

function movementLabel(movement: number): string {
  if (movement > 0) return `+${movement}`;
  if (movement < 0) return `−${Math.abs(movement)}`;
  return "—";
}

function movementClass(movement: number): string {
  if (movement > 0) return "border-win/50 text-win";
  if (movement < 0) return "border-loss/50 text-loss";
  return "border-zinc-700 text-zinc-500";
}

export function LotteryNight(props: { view: DraftLotteryView }) {
  const { view } = props;
  const total = view.slots.length;
  const [count, setRevealed] = useState(0);
  const reduced = useSyncExternalStore(
    () => () => {},
    prefersReducedMotion,
    () => false,
  );
  const revealed = reduced ? total : count;

  useEffect(() => {
    if (revealed >= total) return;
    const timer = window.setTimeout(
      () => setRevealed((n) => Math.min(n + 1, total)),
      REVEAL_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [revealed, total]);

  const done = revealed >= total;
  // Reveal runs last slot to first; the newest reveal sits on top.
  const shown = [...view.slots].reverse().slice(0, revealed).reverse();
  const winner = view.slots[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={() => setRevealed((n) => Math.min(n + 1, total))}
          disabled={done}
        >
          Reveal next
        </Button>
        <Button
          variant="secondary"
          onClick={() => setRevealed(total)}
          disabled={done}
        >
          Show all
        </Button>
      </div>

      {done && winner ? (
        <p
          role="status"
          className="rounded-md border border-team-ink/50 bg-team/15 px-4 py-3 text-sm text-zinc-50"
        >
          {winner.teamName} won the lottery and hold the #1 pick.
          {view.biggestJump
            ? ` Biggest jump: ${view.biggestJump.teamName} moved up ${view.biggestJump.movement}.`
            : ""}
        </p>
      ) : (
        <p className="sr-only" aria-live="polite">
          {revealed} of {total} picks revealed
        </p>
      )}

      <ol className="space-y-2" aria-label="Lottery order">
        {shown.map((slot) => (
          <li
            key={slot.teamId}
            data-user-team={slot.isUserTeam ? "true" : undefined}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2",
              slot.isUserTeam
                ? "border-team-ink/60 bg-team/15"
                : "border-zinc-800 bg-zinc-900/40",
            )}
          >
            <ScoreNumeral
              value={`#${slot.slot}`}
              size="sm"
              tone={slot.isUserTeam ? "team" : "default"}
              className="w-14 shrink-0"
            />
            <TeamBadge
              branding={slot.branding}
              name={slot.teamName}
              size="sm"
              decorative
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">
                {slot.teamName}
                {slot.isUserTeam ? (
                  <span className="ml-2 text-xs text-team-ink">Your pick</span>
                ) : null}
              </p>
              <p className="text-xs text-zinc-500">
                {(slot.odds * 100).toFixed(1)}% odds
                {slot.drawn ? "" : " · By record"}
                {slot.ownerTeamId && slot.ownerTeamId !== slot.teamId
                  ? " · via trade"
                  : ""}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
                movementClass(slot.movement),
              )}
            >
              {movementLabel(slot.movement)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
