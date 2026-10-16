"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Overlay } from "@/components/ui/Overlay";
import { TradeReviewPanel } from "@/components/trades/TradeReviewPanel";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";
import type { CalendarInterrupt } from "@/state/calendar-interrupt";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function OwnerDecisionInterruptModal(props: {
  interrupt: CalendarInterrupt;
  resumeTo: string | null;
  busy: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onLetAiDecide: () => void;
  onNegotiate: () => void;
  onStopSimulation: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const acceptOrPick =
      panel.querySelector<HTMLElement>("button:not([disabled])") ??
      panel.querySelector<HTMLElement>("a[href]");
    acceptOrPick?.focus();
  }, [props.interrupt]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const { interrupt } = props;
  const draftHref =
    interrupt.kind === "draft_clock"
      ? appendResumeTo(interrupt.draftHref, props.resumeTo)
      : null;

  return (
    <Overlay
      dismissible={false}
      className="flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-interrupt-title"
        tabIndex={-1}
        className="relative z-10 max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-xl border border-warning/40 bg-zinc-950 p-5 shadow-xl"
      >
        {interrupt.kind === "trade_offer" ? (
          <TradeReviewPanel
            review={interrupt.review}
            busy={props.busy}
            error={props.error}
            showLetAiDecide={!interrupt.review.bothSidesOwned}
            onAccept={props.onAccept}
            onDecline={props.onDecline}
            onLetAiDecide={props.onLetAiDecide}
            onNegotiate={props.onNegotiate}
            extraActions={
              <StopSimulationButton
                disabled={props.busy}
                onClick={props.onStopSimulation}
              />
            }
          />
        ) : (
          <div className="space-y-4 text-sm text-zinc-200">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-warning">
              Simulation paused
            </p>
            <h2
              id="owner-interrupt-title"
              className="text-2xl font-semibold text-zinc-50"
            >
              You&apos;re on the clock
            </h2>
            <p className="text-zinc-300">
              {interrupt.teamName} must pick at overall #{interrupt.pickNumber}.
            </p>
            {props.error ? (
              <p role="alert" className="text-sm text-red-300">
                {props.error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Link
                href={draftHref ?? interrupt.draftHref}
                className={cn(
                  touchTargetClass,
                  focusRingClass,
                  "rounded-md bg-team px-4 text-sm font-medium text-on-team hover:brightness-110",
                )}
              >
                Make pick
              </Link>
              <StopSimulationButton
                disabled={props.busy}
                onClick={props.onStopSimulation}
              />
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

function StopSimulationButton(props: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        touchTargetClass,
        "rounded-md border border-zinc-600 px-3 text-sm text-zinc-200 hover:border-zinc-400 disabled:opacity-50",
      )}
    >
      Stop simulation
    </button>
  );
}

function appendResumeTo(href: string, resumeTo: string | null): string {
  if (!resumeTo) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}resumeTo=${encodeURIComponent(resumeTo)}`;
}
