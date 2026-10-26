"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { buttonClass } from "@/components/ui/Button";
import { cn, focusRingClass } from "@/components/ui/styles";

export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export type PlaybackStatus = "playing" | "paused" | "complete";

export type PlaybackMoment = {
  /** Plays revealed once the moment has happened. */
  revealed: number;
  title: string;
  detail: string;
};

// "Replay complete", not "Final": the scoreboard already says Final.
const STATUS_LABEL: Record<PlaybackStatus, string> = {
  playing: "Live",
  paused: "Paused",
  complete: "Replay complete",
};

const ICON_BUTTON_CLASS = cn(
  buttonClass({ variant: "quiet" }),
  "min-w-11 px-2",
);

function Icon(props: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-current"
    >
      {props.children}
    </svg>
  );
}

const PlayIcon = () => (
  <Icon>
    <path d="M4 2.5 L13 8 L4 13.5 Z" />
  </Icon>
);
const PauseIcon = () => (
  <Icon>
    <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />
  </Icon>
);
const SkipBackIcon = () => (
  <Icon>
    <path d="M3 2.5h2v11H3zM14 2.5v11L6 8z" />
  </Icon>
);
const SkipForwardIcon = () => (
  <Icon>
    <path d="M11 2.5h2v11h-2zM2 2.5l8 5.5-8 5.5z" />
  </Icon>
);
const MoreIcon = () => (
  <Icon>
    <circle cx="3" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="13" cy="8" r="1.5" />
  </Icon>
);
const KeyboardIcon = () => (
  <Icon>
    <path
      fillRule="evenodd"
      d="M1.5 3.5h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zm1.5 2v1.5h1.5V5.5zm3 0v1.5h1.5V5.5zm3 0v1.5h1.5V5.5zm3 0v1.5H13V5.5zM3 8.5V10h1.5V8.5zm3 0V10h4V8.5zm5.5 0V10H13V8.5z"
    />
  </Icon>
);

/** Closes `onClose` on outside mousedown or Escape while `open`. */
function useDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) {
      return;
    }
    function onMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close.current();
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        close.current();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef]);
}

function Scrubber(props: {
  revealed: number;
  total: number;
  valueText: string;
  periodStarts: number[];
  moments: PlaybackMoment[];
  onSeek: (revealed: number) => void;
  onStep: (direction: -1 | 1) => void;
  onPreviousPossession: () => void;
  onNextPossession: () => void;
}) {
  const { revealed, total, onSeek } = props;
  const ref = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const lastSent = useRef<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const fraction = (value: number) =>
    total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return;
    }
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    const value = Math.round(ratio * total);
    if (value !== lastSent.current) {
      lastSent.current = value;
      onSeek(value);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        props.onStep(1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        props.onStep(-1);
        break;
      case "PageUp":
        props.onNextPossession();
        break;
      case "PageDown":
        props.onPreviousPossession();
        break;
      case "Home":
        onSeek(0);
        break;
      case "End":
        onSeek(total);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={revealed}
      aria-valuetext={props.valueText}
      data-testid="playback-scrubber"
      className={cn(
        "relative flex h-11 min-w-0 cursor-pointer touch-none select-none items-center rounded-md",
        focusRingClass,
      )}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        pressed.current = true;
        lastSent.current = null;
        if (typeof event.currentTarget.setPointerCapture === "function") {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Capture is a nicety; seeking still works without it.
          }
        }
        seekFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (pressed.current) {
          seekFromPointer(event);
        }
      }}
      onPointerUp={() => {
        pressed.current = false;
      }}
      onPointerCancel={() => {
        pressed.current = false;
      }}
    >
      <div className="relative h-1.5 w-full rounded-full bg-line-strong">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-team"
          style={{ width: `${fraction(revealed) * 100}%` }}
        />
        {props.periodStarts.map((start) => (
          <span
            key={`period-${start}`}
            aria-hidden="true"
            data-testid="playback-period-tick"
            className="absolute -inset-y-1 w-px -translate-x-1/2 bg-muted"
            style={{ left: `${fraction(start) * 100}%` }}
          />
        ))}
        {props.moments.map((moment, index) => (
          <span
            key={`moment-${index}`}
            aria-hidden="true"
            data-testid="playback-moment"
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-surface-raised bg-team-ink"
            style={{ left: `${fraction(moment.revealed) * 100}%` }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSeek(moment.revealed);
            }}
          >
            {hovered === index ? (
              <span
                role="presentation"
                className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 max-w-[70vw] -translate-x-1/2 rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-left text-sm font-normal text-soft shadow-lg"
              >
                <span className="block font-medium text-ink">
                  {moment.title}
                </span>
                <span className="block">{moment.detail}</span>
              </span>
            ) : null}
          </span>
        ))}
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow"
          style={{ left: `${fraction(revealed) * 100}%` }}
        />
      </div>
    </div>
  );
}

function OverflowMenu(props: {
  atEnd: boolean;
  showShotChart: boolean;
  onToggleShotChart: () => void;
  onRestart: () => void;
  onSkipToEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const closeMenu = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  };
  useDismiss(open, rootRef, () => closeMenu(true));

  useEffect(() => {
    if (open) {
      itemRefs.current[0]?.focus();
    }
  }, [open]);

  const choose = (action: () => void) => () => {
    action();
    closeMenu(true);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    }
  };

  const itemClass = cn(
    "flex min-h-11 w-full items-center justify-between gap-4 rounded-md px-3 text-left text-sm text-ink hover:bg-surface-high",
    focusRingClass,
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="More playback options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={ICON_BUTTON_CLASS}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="More playback options"
          className="absolute bottom-full right-0 z-30 mb-2 w-52 rounded-md border border-line-strong bg-surface-raised p-1 shadow-lg"
          onKeyDown={onMenuKeyDown}
        >
          <button
            ref={(el) => {
              itemRefs.current[0] = el;
            }}
            type="button"
            role="menuitemcheckbox"
            aria-checked={props.showShotChart}
            className={itemClass}
            onClick={choose(props.onToggleShotChart)}
          >
            Shot chart
            <span aria-hidden="true" className="w-4 text-team-ink">
              {props.showShotChart ? "✓" : ""}
            </span>
          </button>
          <button
            ref={(el) => {
              itemRefs.current[1] = el;
            }}
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={choose(props.onRestart)}
          >
            Restart
          </button>
          <button
            ref={(el) => {
              itemRefs.current[2] = el;
            }}
            type="button"
            role="menuitem"
            aria-disabled={props.atEnd}
            className={cn(itemClass, props.atEnd && "opacity-50")}
            onClick={() => {
              if (props.atEnd) {
                return;
              }
              choose(props.onSkipToEnd)();
            }}
          >
            Skip to end
          </button>
        </div>
      ) : null}
    </div>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ["Space", "Play or pause"],
  ["← / →", "Previous / next possession"],
  [", / .", "Step back / forward one play"],
];

function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  useDismiss(open, rootRef, () => setOpen(false));
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        className={ICON_BUTTON_CLASS}
        onClick={() => setOpen((value) => !value)}
      >
        <KeyboardIcon />
      </button>
      {open ? (
        <div
          id={tipId}
          role="tooltip"
          className="absolute bottom-full right-0 z-30 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-left text-sm text-soft shadow-lg"
        >
          <dl className="space-y-1">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className="flex justify-between gap-3">
                <dt className="font-medium text-ink">{keys}</dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Video-player transport attached to the court's bottom edge: play/pause,
 * possession steps, a seekable scrubber with quarter and key-moment marks,
 * speed, and an overflow menu.
 */
export function PlaybackControls(props: {
  playing: boolean;
  speed: PlaybackSpeed;
  revealed: number;
  total: number;
  clockText: string;
  /** Clock in the scrubber's spoken value (defaults to `clockText`). */
  scrubClockText?: string;
  status: PlaybackStatus;
  /** Revealed counts at which a new period begins. */
  periodStarts: number[];
  moments: PlaybackMoment[];
  showShotChart: boolean;
  onTogglePlay: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onSeek: (revealed: number) => void;
  onStep: (direction: -1 | 1) => void;
  onPreviousPossession: () => void;
  onNextPossession: () => void;
  onRestart: () => void;
  onSkipToEnd: () => void;
  onToggleShotChart: () => void;
}) {
  const atEnd = props.revealed >= props.total;
  return (
    <div
      role="group"
      aria-label="Playback controls"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-b-lg border border-t-0 border-line bg-surface-raised px-3 py-2"
    >
      <button
        type="button"
        data-variant="primary"
        className={cn(buttonClass({ variant: "primary" }), "min-w-11 px-3")}
        onClick={props.onTogglePlay}
        disabled={atEnd && !props.playing}
      >
        {props.playing ? <PauseIcon /> : <PlayIcon />}
        <span className="sr-only">{props.playing ? "Pause" : "Play"}</span>
      </button>
      <button
        type="button"
        className={ICON_BUTTON_CLASS}
        onClick={props.onPreviousPossession}
        disabled={props.revealed <= 0}
      >
        <SkipBackIcon />
        <span className="sr-only">Previous possession</span>
      </button>
      <button
        type="button"
        className={ICON_BUTTON_CLASS}
        onClick={props.onNextPossession}
        disabled={atEnd}
      >
        <SkipForwardIcon />
        <span className="sr-only">Next possession</span>
      </button>
      <span
        aria-hidden="true"
        className="min-w-16 text-sm tabular-nums text-soft"
      >
        {props.clockText}
      </span>
      <div className="order-first min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
        <Scrubber
          revealed={props.revealed}
          total={props.total}
          valueText={`${props.revealed} of ${props.total} plays${
            (props.scrubClockText ?? props.clockText)
              ? `, ${props.scrubClockText ?? props.clockText}`
              : ""
          }`}
          periodStarts={props.periodStarts}
          moments={props.moments}
          onSeek={props.onSeek}
          onStep={props.onStep}
          onPreviousPossession={props.onPreviousPossession}
          onNextPossession={props.onNextPossession}
        />
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Speed">
        {PLAYBACK_SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={props.speed === speed}
            className={cn(
              buttonClass({ variant: "secondary" }),
              "min-w-11 px-2 tabular-nums",
              props.speed === speed &&
                "border-team-ink bg-team/15 text-team-ink",
            )}
            onClick={() => props.onSpeedChange(speed)}
          >
            {speed}x
          </button>
        ))}
      </div>
      <OverflowMenu
        atEnd={atEnd}
        showShotChart={props.showShotChart}
        onToggleShotChart={props.onToggleShotChart}
        onRestart={props.onRestart}
        onSkipToEnd={props.onSkipToEnd}
      />
      <ShortcutsHelp />
      <p data-testid="court-status" className="sr-only" aria-live="polite">
        {STATUS_LABEL[props.status]}
      </p>
    </div>
  );
}
