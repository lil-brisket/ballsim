const TONE: Record<string, string> = {
  success: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  warning: "border-warning/40 bg-warning/10 text-warning",
  critical: "border-rose-700/50 bg-rose-950/40 text-rose-300",
  info: "border-line-strong bg-surface-raised text-soft",
  active: "border-team-ink/50 bg-team/15 text-team-ink",
  completed: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  failed: "border-rose-700/50 bg-rose-950/40 text-rose-300",
  healthy: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  available: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  minor: "border-yellow-700/50 bg-yellow-950/40 text-yellow-300",
  questionable: "border-warning/40 bg-warning/10 text-warning",
  limited: "border-orange-700/50 bg-orange-950/40 text-orange-300",
  recovery: "border-sky-700/50 bg-sky-950/40 text-sky-300",
  injured: "border-rose-700/50 bg-rose-950/40 text-rose-300",
  out: "border-rose-700/50 bg-rose-950/40 text-rose-300",
  suspended: "border-rose-700/50 bg-rose-950/40 text-rose-300",
  neutral: "border-line-strong bg-surface-raised text-muted",
};

export function StatusBadge(props: { label: string; tone?: string }) {
  const toneClass = TONE[props.tone ?? props.label] ?? TONE.info;
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${toneClass}`}
    >
      {props.label}
    </span>
  );
}
