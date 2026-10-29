"use client";

import { type ReactNode, useId } from "react";
import {
  INJURY_FREQUENCIES,
  INJURY_FREQUENCY_LABELS,
  type InjuryFrequency,
} from "@/domain/game-settings";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { buttonClass } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Select } from "@/components/ui/Select";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, focusRingClass } from "@/components/ui/styles";

export const inputClass =
  "min-h-11 w-full rounded-md border border-line-strong bg-surface-base px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass = buttonClass({ variant: "secondary" });

export const primaryButtonClass = buttonClass({ variant: "primary" });

export function SetupSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-xl border border-line bg-surface-raised/40 p-4 sm:p-5"
    >
      <div className="space-y-1">
        <SectionHeading id={id} tabIndex={-1} title={title} />
        {description ? (
          <p className="text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm text-soft">
      <span>{label}</span>
      <Select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        wrapperClassName="w-full"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  disabled = false,
  note,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Short status shown after the label, e.g. "Coming soon". */
  note?: string;
}) {
  return (
    <label
      className={`flex min-h-11 items-center gap-3 text-sm ${disabled ? "text-faint" : "text-soft"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 rounded border-disabled bg-surface-base text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
      />
      {label}
      {note ? <span className="text-sm text-faint">{note}</span> : null}
    </label>
  );
}

export function MoneyInputField({
  label,
  value,
  min,
  max,
  defaultValue,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const millions = value / 1_000_000;
  const inputId = useId();
  return (
    <div className="block space-y-1 text-sm text-soft sm:col-span-2">
      <label htmlFor={inputId} className="block font-medium text-ink">
        {label} — {formatMoney(value)}
      </label>
      <span className="block text-sm text-faint">
        Range {formatMoney(min)}–{formatMoney(max)}. Default{" "}
        {formatMoney(defaultValue)}.
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <NumberStepper
          id={inputId}
          disabled={disabled}
          min={min / 1_000_000}
          max={max / 1_000_000}
          step={1}
          value={Number.isFinite(millions) ? millions : undefined}
          onValueChange={(parsed) => {
            const dollars = Math.round(parsed * 1_000_000);
            onChange(Math.min(max, Math.max(min, dollars)));
          }}
        />
        <span className="text-sm text-faint">million dollars</span>
      </span>
    </div>
  );
}

export function InjuryFrequencyField({
  value,
  onChange,
}: {
  value: InjuryFrequency;
  onChange: (value: InjuryFrequency) => void;
}) {
  const selectedIndex = INJURY_FREQUENCIES.indexOf(value);
  const selectedLabel = INJURY_FREQUENCY_LABELS[value];

  function setByIndex(index: number) {
    const next = INJURY_FREQUENCIES[Math.max(0, Math.min(2, index))];
    if (next) {
      onChange(next);
    }
  }

  return (
    <div className="space-y-2 text-sm text-soft sm:col-span-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium text-ink">
          Injury frequency — {selectedLabel}
        </span>
      </div>
      <p className="text-sm text-faint">
        Affects how frequently players become injured during simulation.
      </p>
      <div
        role="radiogroup"
        aria-label={`Injury frequency — ${selectedLabel}`}
        className="flex rounded-md border border-line-strong bg-surface-base p-0.5"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            setByIndex(selectedIndex - 1);
          } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            setByIndex(selectedIndex + 1);
          } else if (event.key === "Home") {
            event.preventDefault();
            setByIndex(0);
          } else if (event.key === "End") {
            event.preventDefault();
            setByIndex(2);
          }
        }}
      >
        {INJURY_FREQUENCIES.map((frequency) => {
          const selected = frequency === value;
          return (
            <button
              key={frequency}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(frequency)}
              className={cn(
                "min-h-11 flex-1 rounded px-3 py-2 text-center text-sm transition-colors",
                focusRingClass,
                selected
                  ? "bg-team font-medium text-on-team"
                  : "text-muted hover:bg-surface-raised hover:text-ink",
              )}
            >
              {INJURY_FREQUENCY_LABELS[frequency]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
