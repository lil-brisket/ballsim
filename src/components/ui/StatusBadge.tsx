const TONE: Record<string, string> = {
  success: "border-success/50 bg-success-soft text-success-ink",
  warning: "border-warning/40 bg-warning/10 text-warning",
  critical: "border-danger/50 bg-danger-soft text-danger-ink",
  info: "border-line-strong bg-surface-raised text-soft",
  active: "border-team-ink/50 bg-team/15 text-team-ink",
  completed: "border-success/50 bg-success-soft text-success-ink",
  failed: "border-danger/50 bg-danger-soft text-danger-ink",
  healthy: "border-success/50 bg-success-soft text-success-ink",
  available: "border-success/50 bg-success-soft text-success-ink",
  minor: "border-caution/50 bg-caution-soft text-caution-ink",
  questionable: "border-warning/40 bg-warning/10 text-warning",
  limited: "border-caution/50 bg-caution-soft text-caution-ink",
  recovery: "border-info/50 bg-info-soft text-info-ink",
  injured: "border-danger/50 bg-danger-soft text-danger-ink",
  out: "border-danger/50 bg-danger-soft text-danger-ink",
  suspended: "border-danger/50 bg-danger-soft text-danger-ink",
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
