import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { TickerBar, type TickerItem } from "@/components/ui/TickerBar";
import type { DraftHubView } from "@/state/draft-hub-selectors";

export function DraftHeaderStrip(props: { view: DraftHubView }) {
  const { view } = props;
  const items: TickerItem[] = [];
  if (view.draftYear != null) {
    items.push({ label: "Draft year", value: String(view.draftYear) });
  }
  if (view.draftDate) {
    items.push({ label: "Draft date", value: view.draftDate });
  }
  items.push(
    { label: "Status", value: view.status?.replaceAll("_", " ") ?? "—" },
    { label: "Your picks", value: String(view.ownedPickCount), tone: "team" },
    { label: "Roster", value: String(view.rosterCount) },
  );
  if (view.userOnClock && view.onClockOverall != null) {
    items.push({
      label: "On the clock",
      value: `Pick #${view.onClockOverall}`,
      tone: "live",
    });
  }

  return (
    <ArenaPanel as="div" edge="top" density="compact">
      <TickerBar aria-label="Draft summary" items={items} />
    </ArenaPanel>
  );
}
