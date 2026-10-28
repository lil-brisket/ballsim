"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useModalKeys } from "@/components/calendar/use-modal-keys";
import { prefersReducedMotion } from "@/components/ui/CountUp";
import { Button } from "@/components/ui/Button";
import { KeyHint } from "@/components/ui/KeyHint";
import { Overlay } from "@/components/ui/Overlay";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { playUiSound } from "@/components/ui/sound/ui-sound";
import { cn } from "@/components/ui/styles";

export type MomentStep = {
  /** Stable id; a new id replays the step's entrance. */
  id: string;
  eyebrow?: string;
  title: string;
  body?: ReactNode;
  /** Plays the big-moment sting when the step is revealed. */
  sting?: boolean;
};

function subscribeNever(): () => void {
  return () => {};
}

/**
 * Full-screen presentation beat in team colours: a sequence of steps with a
 * progress row, `Next` (Enter, pad A) and `Skip all` (Esc, pad B). Never
 * blocks play: every step can be skipped and the same facts live on a normal
 * page. Under reduced motion only `summary` is shown, as one static card.
 * Sound follows the sound setting (off by default).
 */
export function MomentOverlay(props: {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog, e.g. "Progression reveal". */
  label: string;
  steps: readonly MomentStep[];
  /** The whole moment on one card (reduced motion). */
  summary: Omit<MomentStep, "sting">;
  /** Advance on a timer; off by default. Ignored under reduced motion. */
  autoAdvanceMs?: number;
}) {
  if (!props.open) return null;
  // Mounted per open, so each opening starts at the first step.
  return <MomentDialog {...props} />;
}

function MomentDialog(props: {
  onClose: () => void;
  label: string;
  steps: readonly MomentStep[];
  summary: Omit<MomentStep, "sting">;
  autoAdvanceMs?: number;
}) {
  const { onClose, autoAdvanceMs } = props;
  const reduced = useSyncExternalStore(
    subscribeNever,
    prefersReducedMotion,
    () => true,
  );
  const steps: readonly MomentStep[] =
    reduced || props.steps.length === 0 ? [props.summary] : props.steps;
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const last = index >= steps.length - 1;

  const panelRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  useModalKeys(panelRef, true, onClose);
  // After useModalKeys: start on Next so Enter and pad A advance.
  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  // Keyed on the step id: `summary` is often an inline object.
  const sting = step.sting === true;
  useEffect(() => {
    playUiSound(sting ? "sting" : index === 0 ? "simDone" : "select");
  }, [step.id, sting, index]);

  useEffect(() => {
    if (!autoAdvanceMs || reduced || last) return;
    const timer = window.setTimeout(
      () => setIndex((current) => current + 1),
      autoAdvanceMs,
    );
    return () => window.clearTimeout(timer);
  }, [autoAdvanceMs, reduced, last, index]);

  function next() {
    if (last) onClose();
    else setIndex(index + 1);
  }

  return (
    <Overlay
      transparent
      dismissible={false}
      className="moment-overlay flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        tabIndex={-1}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-2xl flex-col gap-6 overflow-y-auto rounded-2xl border border-team-ink/30 bg-surface-arena/90 p-6 shadow-arena sm:p-8"
      >
        <p className="sr-only" aria-live="polite">
          {`Step ${index + 1} of ${steps.length}: ${step.title}`}
        </p>

        <div key={step.id} className="moment-step min-h-0 space-y-4">
          <SectionHeading
            as="h2"
            size="lg"
            tone="team"
            eyebrow={step.eyebrow}
            title={step.title}
          />
          {step.body ? <div className="text-soft">{step.body}</div> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {steps.length > 1 ? (
            <div className="flex items-center gap-3">
              <ol aria-hidden="true" className="flex items-center gap-1.5">
                {steps.map((item, position) => (
                  <li
                    key={item.id}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      position === index
                        ? "w-6 bg-team-ink"
                        : position < index
                          ? "w-2 bg-team-ink/60"
                          : "w-2 bg-line-strong",
                    )}
                  />
                ))}
              </ol>
              <span className="text-sm tabular-nums text-muted">
                {index + 1} / {steps.length}
              </span>
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button ref={nextRef} variant="primary" onClick={next}>
              {last ? "Done" : "Next"}
              <KeyHint keys="Enter" />
            </Button>
            {!last ? (
              <Button variant="quiet" onClick={onClose}>
                Skip all
                <KeyHint keys="Esc" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
