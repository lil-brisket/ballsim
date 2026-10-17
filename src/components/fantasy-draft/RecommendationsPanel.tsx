import type { FantasyDraftView } from "@/state/selectors";
import { SectionHeading } from "@/components/ui/SectionHeading";

function RecCard(props: {
  label: string;
  player: FantasyDraftView["bestAvailable"];
}) {
  if (!props.player) {
    return (
      <div className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500">
        {props.label}: —
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-800 px-3 py-2 text-sm">
      <div className="text-zinc-400">{props.label}</div>
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
      <SectionHeading title="Recommendations" className="mb-2" />
      <p className="mb-3 text-sm text-zinc-500">
        Informational only — you can draft any eligible player.
      </p>
      <div className="space-y-2">
        <RecCard label="Best available" player={props.draft.bestAvailable} />
        <RecCard label="Best fit" player={props.draft.bestFit} />
      </div>
    </section>
  );
}
