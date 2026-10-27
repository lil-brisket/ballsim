"use client";

import { useRef } from "react";
import { useModalKeys } from "@/components/calendar/use-modal-keys";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatGameDate } from "@/presentation/game-date";
import { buttonClass } from "@/components/ui/Button";
import { Overlay } from "@/components/ui/Overlay";

export function SimulateToDateConfirm(props: {
  date: string;
  disabled?: boolean;
  onConfirm: (date: string) => void;
  onCancel: () => void;
  /** Next owner game on this date; offers watching it live. */
  watchGame?: { gameId: string };
  onWatch?: (gameId: string, date: string) => void;
}) {
  const watchGame = props.watchGame;
  const onWatch = props.onWatch;
  const canWatch = watchGame != null && onWatch != null;
  const panelRef = useRef<HTMLDivElement>(null);
  useModalKeys(panelRef, true, props.onCancel);
  return (
    <Overlay
      className="flex items-center justify-center p-4"
      onClick={props.onCancel}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulate-to-date-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-line-strong bg-surface-raised p-5 shadow-xl"
      >
        <SectionHeading
          as="h3"
          id="simulate-to-date-title"
          title={
            canWatch
              ? `Your next game is ${formatGameDate(props.date)}`
              : `Simulate through ${formatGameDate(props.date)}?`
          }
        />
        <p className="mt-2 text-sm text-muted">
          {canWatch
            ? "Watch it live on the broadcast court, or sim to that day and stop before tip-off."
            : "This plays all games, including yours, up to that day."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className={buttonClass({ variant: "secondary" })}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => {
              if (!props.disabled) {
                props.onConfirm(props.date);
              }
            }}
            className={buttonClass({
              variant: canWatch ? "secondary" : "primary",
            })}
          >
            {canWatch ? "Sim to day" : "Simulate to date"}
          </button>
          {canWatch ? (
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => {
                if (!props.disabled) {
                  onWatch(watchGame.gameId, props.date);
                }
              }}
              className={buttonClass({ variant: "primary" })}
            >
              Watch game
            </button>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}
