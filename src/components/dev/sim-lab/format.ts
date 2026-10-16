export const labFieldClass =
  "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-team-ink/40 focus:ring-2 disabled:opacity-50";

export const labPrimaryButtonClass =
  "rounded-md bg-team px-4 py-2 text-sm font-medium text-on-team hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink disabled:opacity-50";

export function formatDurationMs(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = (ms % 60_000) / 1000;
  return `${minutes}m ${seconds.toFixed(1)}s`;
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatFixed(value: number, digits = 2): string {
  return value.toFixed(digits);
}
