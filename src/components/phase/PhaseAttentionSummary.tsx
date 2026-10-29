import type { PhaseAttentionSummary } from "@/state/phase-dashboard";

export function PhaseAttentionSummaryPanel(props: {
  attention: PhaseAttentionSummary;
}) {
  const { required, counts } = props.attention;
  const total = counts.required + counts.recommended + counts.optional;

  if (total === 0) {
    return (
      <section
        className="rounded-xl border border-success/40 bg-success-soft px-4 py-3"
        aria-label="Needs attention"
      >
        <p className="text-sm font-medium text-success">Needs attention</p>
        <p className="mt-1 text-sm text-soft">
          No required or recommended actions for this franchise right now.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3"
      aria-label="Needs attention"
    >
      <p className="text-sm font-medium text-warning">
        Needs attention — {counts.required + counts.recommended}
      </p>
      <ul className="mt-2 flex flex-wrap gap-3 text-sm">
        <li className="text-danger-ink">
          Required: {counts.required}
          {required.length > 0 ? ` · ${required[0]!.title}` : ""}
        </li>
        <li className="text-warning">Recommended: {counts.recommended}</li>
        <li className="text-info-ink">Optional: {counts.optional}</li>
      </ul>
    </section>
  );
}
