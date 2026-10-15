import { AttributeRadar } from "@/components/basketball/player-card/AttributeRadar";
import { PlayerRatingGrid } from "@/components/basketball/PlayerRatingGrid";
import { Section } from "@/components/ui/Section";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";

export function AttributesTab(props: { view: PlayerDrawerView }) {
  return (
    <>
      <AttributeRadar attributes={props.view.ratings.attributes} size="md" />
      <Section title="Ratings" density="compact">
        <PlayerRatingGrid
          key={props.view.playerId}
          attributes={props.view.ratings.attributes}
        />
      </Section>
    </>
  );
}
