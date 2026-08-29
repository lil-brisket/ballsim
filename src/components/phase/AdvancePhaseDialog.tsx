import Link from "next/link";
import type { PhaseDashboardView } from "@/state/phase-dashboard";

export function AdvancePhaseDialog(props: {
  view: PhaseDashboardView;
  saveId: string;
  returnPath: string;
  advanceAction: (formData: FormData) => void | Promise<void>;
}) {
  if (!props.view.showAdvanceControl) {
    return null;
  }

  const { preview } = props.view;
  const blocked = !preview.canAdvance;

  return (
    <section
      className="rounded-xl border border-zinc-600 bg-zinc-900/70 px-4 py-4"
      aria-label="Advance phase"
    >
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
        Advance
      </p>
      <h3 className="mt-1 text-base font-medium text-zinc-50">
        Advance to {preview.toPhaseName}
      </h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
        {preview.consequences.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {preview.recommendedRemaining > 0 ? (
        <p className="mt-2 text-sm text-amber-300/90">
          {preview.recommendedRemaining} recommended action
          {preview.recommendedRemaining === 1 ? "" : "s"} remain on your
          franchise{props.view.ownedTeams.length > 1 ? "s" : ""}.
        </p>
      ) : null}
      {blocked && preview.blockReason ? (
        <p className="mt-2 text-sm text-red-300">{preview.blockReason}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {blocked ? (
          <Link
            href={props.view.attention.required[0]?.href ?? props.returnPath}
            className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-sm text-amber-200 hover:border-amber-500"
          >
            Review required actions
          </Link>
        ) : (
          <form action={props.advanceAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-200 hover:border-emerald-500"
            >
              Advance to {preview.toPhaseName}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
