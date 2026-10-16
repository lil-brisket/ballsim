"use client";

import { useId } from "react";
import { cn } from "@/components/ui/styles";

export type RadioCardOption<T extends string> = {
  value: T;
  title: string;
  description: string;
  meta?: string;
  /** Shown but not selectable (e.g. a planned feature). */
  disabled?: boolean;
};

/**
 * Native radio inputs styled as cards. Arrow-key navigation and the single tab
 * stop come from the browser's radio group behaviour.
 */
export function RadioCardGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = 2,
}: {
  legend: string;
  options: ReadonlyArray<RadioCardOption<T>>;
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3;
}) {
  const uid = useId();
  return (
    <div className="space-y-2">
      <p id={`${uid}-legend`} className="text-sm font-medium text-zinc-200">
        {legend}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${uid}-legend`}
        className={cn(
          "grid gap-3",
          columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {options.map((option) => {
          const titleId = `${uid}-${option.value}-title`;
          const descId = `${uid}-${option.value}-desc`;
          return (
            <label
              key={option.value}
              className={cn(
                "block",
                option.disabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                name={uid}
                value={option.value}
                checked={option.value === value}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                aria-labelledby={titleId}
                aria-describedby={descId}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block h-full min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-left transition-colors",
                  option.disabled ? "opacity-60" : "hover:border-team-ink",
                  "peer-checked:border-team-ink peer-checked:bg-team/15 peer-checked:ring-1 peer-checked:ring-team-ink",
                  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-team-ink",
                )}
              >
                <span
                  id={titleId}
                  className="block text-sm font-medium text-zinc-100"
                >
                  {option.title}
                </span>
                <span id={descId} className="mt-1 block text-xs text-zinc-400">
                  {option.description}
                </span>
                {option.meta ? (
                  <span
                    className={cn(
                      "mt-2 block text-xs font-medium",
                      option.disabled ? "text-zinc-400" : "text-team-ink",
                    )}
                  >
                    {option.meta}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
