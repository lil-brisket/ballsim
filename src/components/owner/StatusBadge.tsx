const TONE: Record<string, string> = {
  success: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  warning: "border-amber-700/50 bg-amber-950/40 text-amber-300",
  critical: "border-rose-700/50 bg-rose-950/40 text-rose-300",
  info: "border-zinc-700 bg-zinc-900 text-zinc-300",
  active: "border-amber-700/50 bg-amber-950/40 text-amber-300",
  completed: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  failed: "border-rose-700/50 bg-rose-950/40 text-rose-300",
  healthy: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  injured: "border-rose-700/50 bg-rose-950/40 text-rose-300",
};

export function StatusBadge(props: {
  label: string;
  tone?: string;
}) {
  const toneClass = TONE[props.tone ?? props.label] ?? TONE.info;
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${toneClass}`}
    >
      {props.label}
    </span>
  );
}
