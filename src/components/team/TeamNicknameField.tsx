"use client";

import { Button } from "@/components/ui/Button";
export function TeamNicknameField(props: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  onRandomize?: () => void;
  helperText?: string;
}) {
  const errorId = `${props.id}-error`;
  const helperId = `${props.id}-helper`;
  const describedBy = [
    props.error ? errorId : null,
    props.helperText ? helperId : null,
  ]
    .filter((value): value is string => value !== null)
    .join(" ");

  return (
    <div className="space-y-1">
      <label className="block text-sm text-zinc-300" htmlFor={props.id}>
        Team name
      </label>
      <div className="flex gap-2">
        <input
          id={props.id}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          disabled={props.disabled}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy.length > 0 ? describedBy : undefined}
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-team-ink/40 focus:ring-2 disabled:opacity-50"
        />
        {props.onRandomize ? (
          <Button
            type="button"
            variant="secondary"
            onClick={props.onRandomize}
            disabled={props.disabled}
            aria-label="Randomize team name"
          >
            ↻
          </Button>
        ) : null}
      </div>
      {props.error ? (
        <p id={errorId} className="text-sm text-red-400" role="alert">
          {props.error}
        </p>
      ) : props.helperText ? (
        <p id={helperId} className="text-sm text-zinc-500">
          {props.helperText}
        </p>
      ) : null}
    </div>
  );
}
