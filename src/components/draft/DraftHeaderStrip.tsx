import { Metric } from "@/components/ui/Metric";
import type { DraftHubView } from "@/state/draft-hub-selectors";

export function DraftHeaderStrip(props: { view: DraftHubView }) {
  const { view } = props;
  return (
    <div
      className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
      aria-label="Draft summary"
    >
      {view.draftYear != null ? (
        <Metric label="Draft year" value={String(view.draftYear)} density="compact" />
      ) : null}
      {view.draftDate ? (
        <Metric label="Draft date" value={view.draftDate} mono density="compact" />
      ) : null}
      <Metric
        label="Status"
        value={view.status?.replaceAll("_", " ") ?? "—"}
        density="compact"
      />
      <Metric
        label="Your picks"
        value={String(view.ownedPickCount)}
        density="compact"
      />
      <Metric
        label="Roster"
        value={String(view.rosterCount)}
        density="compact"
      />
      {view.userOnClock && view.onClockOverall != null ? (
        <Metric
          label="On the clock"
          value={`Pick #${view.onClockOverall}`}
          density="compact"
        />
      ) : null}
    </div>
  );
}
