"use client";

import { Button } from "@/components/ui/Button";

/**
 * Quiet button that reopens a moment from the page that holds its facts.
 * Focus returns here when the moment closes.
 */
export function MomentReplayButton(props: {
  onReplay: () => void;
  /** e.g. "Replay progression". */
  label: string;
  className?: string;
}) {
  return (
    <Button
      variant="quiet"
      onClick={props.onReplay}
      className={props.className}
    >
      <span aria-hidden="true">↻</span>
      {props.label}
    </Button>
  );
}
