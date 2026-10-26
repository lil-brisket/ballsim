import type { FantasyDraftView } from "@/state/selectors";
import { SectionHeading } from "@/components/ui/SectionHeading";

function RecCard(props: {
  label: string;
  player: FantasyDraftView["bestAvailable"];
}) {
  if (!props.player) {
    return (
      <div className="rounded-lg border border-line px-3 py-2 text-sm text-faint">
        {props.label}: —
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line px-3 py-2 text-sm">
      <div className="text-muted">{props.label}</div>
      <div className="mt-1 font-medium text-ink">
        {props.player.firstName} {props.player.lastName}
      </div>
      <div className="text-faint">
        {props.player.position} · {props.player.overall} OVR ·{" "}
        {props.player.potential} POT
      </div>
    </div>
  );
}

export function RecommendationsPanel(props: { draft: FantasyDraftView }) {
  return (
    <section className="rounded-xl border border-line p-4">
      <SectionHeading title="Recommendations" className="mb-2" />
      <p className="mb-3 text-sm text-faint">
        Informational only — you can draft any eligible player.
      </p>
      <div className="space-y-2">
        <RecCard label="Best available" player={props.draft.bestAvailable} />
        <RecCard label="Best fit" player={props.draft.bestFit} />
      </div>
    </section>
  );
}
