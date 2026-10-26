"use client";

import { useState } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

/**
 * − value + control with 44px buttons. The input is still a real form field
 * (`name`, arrows/PageUp/PageDown via the native number input), so server
 * actions keep working. Controlled with `value` + `onValueChange`, or
 * uncontrolled with `defaultValue`.
 */
export function NumberStepper(props: {
  name?: string;
  id?: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  required?: boolean;
  /** Accessible name when there is no visible `<label htmlFor>`. */
  "aria-label"?: string;
  /** Optional unit shown after the value, e.g. "min". */
  suffix?: string;
  className?: string;
  inputClassName?: string;
}) {
  const step = props.step ?? 1;
  const [inner, setInner] = useState<number>(
    props.defaultValue ?? props.min ?? 0,
  );
  const controlled = props.value != null;
  const value = controlled ? props.value! : inner;

  function set(next: number) {
    const clamped = clamp(next, props.min, props.max);
    if (!controlled) setInner(clamped);
    props.onValueChange?.(clamped);
  }

  const buttonClass = cn(
    "inline-flex min-h-11 min-w-11 items-center justify-center text-lg text-soft transition touch-manipulation hover:bg-surface-high hover:text-ink active:opacity-80 disabled:pointer-events-none disabled:opacity-40",
    focusRingClass,
  );

  return (
    <span
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md border border-line-strong bg-surface-raised",
        props.className,
      )}
    >
      <button
        type="button"
        className={buttonClass}
        aria-label="Decrease"
        disabled={props.disabled || (props.min != null && value <= props.min)}
        onClick={() => set(value - step)}
      >
        −
      </button>
      <span className="inline-flex items-center border-x border-line">
        <input
          type="number"
          id={props.id}
          name={props.name}
          value={Number.isFinite(value) ? value : ""}
          min={props.min}
          max={props.max}
          step={step}
          disabled={props.disabled}
          required={props.required}
          aria-label={props["aria-label"]}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (event.target.value === "" || !Number.isFinite(parsed)) {
              if (!controlled) setInner(Number.NaN);
              return;
            }
            if (!controlled) setInner(parsed);
            props.onValueChange?.(parsed);
          }}
          onBlur={() => {
            if (Number.isFinite(value)) set(value);
            else set(props.min ?? 0);
          }}
          className={cn(
            "w-16 appearance-none bg-transparent text-center font-mono text-sm tabular-nums text-ink [appearance:textfield] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            props.inputClassName,
          )}
        />
        {props.suffix ? (
          <span className="pr-2 text-sm text-muted">{props.suffix}</span>
        ) : null}
      </span>
      <button
        type="button"
        className={buttonClass}
        aria-label="Increase"
        disabled={props.disabled || (props.max != null && value >= props.max)}
        onClick={() => set(value + step)}
      >
        +
      </button>
    </span>
  );
}
