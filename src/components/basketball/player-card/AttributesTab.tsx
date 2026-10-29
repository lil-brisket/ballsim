import { AttributeRadar } from "@/components/basketball/player-card/AttributeRadar";
import { CategoryBoxes } from "@/components/basketball/PlayerBoxes";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";

export function AttributesTab(props: { view: PlayerDrawerView }) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      <AttributeRadar attributes={props.view.ratings.attributes} size="md" />
      <CategoryBoxes
        key={props.view.playerId}
        attributes={props.view.ratings.attributes}
      />
    </div>
  );
}
