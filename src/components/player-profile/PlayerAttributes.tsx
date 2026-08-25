import { Section } from "@/components/owner/Section";
import { AttributeBar } from "@/components/player-profile/AttributeBar";
import type { PlayerAttributes } from "@/domain/entities/player";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

const CATEGORIES: Array<{
  title: string;
  keys: Array<keyof PlayerAttributes>;
}> = [
  { title: "Scoring", keys: ["finishing", "midRange"] },
  { title: "Shooting", keys: ["threePoint", "freeThrow"] },
  { title: "Playmaking", keys: ["ballHandling", "passing"] },
  { title: "Rebounding", keys: ["rebounding"] },
  {
    title: "Defense",
    keys: ["perimeterDefense", "interiorDefense", "steal", "block"],
  },
  {
    title: "Athleticism",
    keys: ["speed", "strength", "athleticism", "stamina"],
  },
  {
    title: "Mental",
    keys: ["basketballIq", "offensiveIq", "defensiveIq", "consistency"],
  },
];

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
      {CATEGORIES.map((category) => (
        <Section key={category.title} title={category.title}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {category.keys.map((key) => {
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
