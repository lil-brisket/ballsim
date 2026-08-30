import type { FantasyDraftView } from "@/state/selectors";

function RecCard(props: {
  label: string;
  player: FantasyDraftView["bestAvailable"];
}) {
  if (!props.player) {
    return (
      <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-500">
        {props.label}: —
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
      <div className="uppercase tracking-wide text-zinc-500">{props.label}</div>
      <div className="mt-1 font-medium text-zinc-100">
        {props.player.firstName} {props.player.lastName}
      </div>
      <div className="text-zinc-500">
        {props.player.position} · {props.player.overall} OVR ·{" "}
        {props.player.potential} POT
      </div>
    </div>
  );
}

export function RecommendationsPanel(props: { draft: FantasyDraftView }) {
  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-400">
        Recommendations
      </h2>
      <p className="mb-3 text-[11px] text-zinc-500">
        Informational only — you can draft any eligible player.
      </p>
      <div className="space-y-2">
        <RecCard label="Best available" player={props.draft.bestAvailable} />
        <RecCard label="Best fit" player={props.draft.bestFit} />
      </div>
    </section>
  );
}
