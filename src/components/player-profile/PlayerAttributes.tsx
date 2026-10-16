import { AttributeRadar } from "@/components/basketball/player-card/AttributeRadar";
import { PlayerRatingGrid } from "@/components/basketball/PlayerRatingGrid";
import { Section } from "@/components/ui/Section";
import { AttributeBar } from "@/components/player-profile/AttributeBar";
import type { PlayerAttributes } from "@/domain/entities/player";
import { RATING_CATEGORIES } from "@/presentation/player-rating-categories";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1");
}

function developmentSeries(
  player: PlayerProfileView,
  key: keyof PlayerAttributes,
): string | null {
  const points = player.attributeDevelopment[key] ?? [];
  if (points.length < 2) return null;
  return points
    .filter((p) => p.value !== null)
    .map((p) => String(p.value))
    .join(" → ");
}

export function PlayerAttributesPanel(props: { player: PlayerProfileView }) {
  const { player } = props;
  const values = Object.values(player.attributes);
  const sorted = [...values].sort((a, b) => b - a);
  const strongCut = sorted[2] ?? 99;
  const weakCut = sorted[sorted.length - 3] ?? 1;

  return (
    <div className="space-y-6">
      <AttributeRadar
        attributes={player.attributes as PlayerAttributes}
        size="md"
      />
      <Section title="Ratings" density="compact">
        <PlayerRatingGrid
          key={player.playerId}
          attributes={player.attributes as PlayerAttributes}
        />
      </Section>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-team-ink">
        Attribute detail and development
      </p>
      {RATING_CATEGORIES.map((category) => (
        <Section key={category.key} title={category.label} density="compact">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {category.attributes.map((key) => {
              const value = player.attributes[key];
              let highlight: "strong" | "weak" | null = null;
              if (value >= strongCut && value >= 75) highlight = "strong";
              if (value <= weakCut && value <= 55) highlight = "weak";
              return (
                <AttributeBar
                  key={key}
                  label={formatLabel(key)}
                  value={value}
                  highlight={highlight}
                  development={developmentSeries(player, key)}
                />
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}
