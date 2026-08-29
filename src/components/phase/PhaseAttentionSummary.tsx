import type { PhaseAttentionSummary } from "@/state/phase-dashboard";

export function PhaseAttentionSummaryPanel(props: {
  attention: PhaseAttentionSummary;
}) {
  const { required, recommended, optional, counts } = props.attention;
  const total = counts.required + counts.recommended + counts.optional;

  if (total === 0) {
    return (
      <section
        className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3"
        aria-label="Needs attention"
      >
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-500">
          Needs attention
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          No required or recommended actions for this franchise right now.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3"
      aria-label="Needs attention"
    >
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
        Needs attention — {counts.required + counts.recommended}
      </p>
      <ul className="mt-2 flex flex-wrap gap-3 text-sm">
        <li className="text-red-300">
          Required: {counts.required}
          {required.length > 0 ? ` · ${required[0]!.title}` : ""}
        </li>
        <li className="text-amber-300">
          Recommended: {counts.recommended}
        </li>
        <li className="text-sky-300">Optional: {counts.optional}</li>
      </ul>
    </section>
  );
}
