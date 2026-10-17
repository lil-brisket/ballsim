import { ScoreNumeral } from "@/components/ui/ScoreNumeral";

export type SeasonAverageValues = {
  games: React.ReactNode;
  mpg: React.ReactNode;
  ppg: React.ReactNode;
  rpg: React.ReactNode;
  apg: React.ReactNode;
  spg: React.ReactNode;
  bpg: React.ReactNode;
  /** Optional extras (profile page), shown small after BLK. */
  extras?: { label: string; value: React.ReactNode }[];
};

/**
 * Broadcast lower-third strip: PTS / REB / AST as the focal numbers, the
 * supporting counting stats small beside them. Values arrive pre-formatted.
 */
export function SeasonAverageStrip(props: { values: SeasonAverageValues }) {
  const { values } = props;
  const large = [
    { label: "PTS", value: values.ppg },
    { label: "REB", value: values.rpg },
    { label: "AST", value: values.apg },
  ];
  const small = [
    { label: "GP", value: values.games },
    { label: "MIN", value: values.mpg },
    { label: "STL", value: values.spg },
    { label: "BLK", value: values.bpg },
    ...(values.extras ?? []),
  ];
  return (
    <div
      role="group"
      aria-label="Season averages"
      className="flex flex-col gap-4 rounded-lg border border-surface-line border-l-4 border-l-team-ink bg-surface-deep/80 px-4 py-3 sm:flex-row sm:items-end sm:gap-8"
    >
      <div className="flex gap-6 sm:gap-8">
        {large.map((item) => (
          <ScoreNumeral
            key={item.label}
            value={item.value}
            label={item.label}
            labelBelow
            size="md"
            tone="team"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 sm:border-l sm:border-surface-line sm:pl-8">
        {small.map((item) => (
          <ScoreNumeral
            key={item.label}
            value={item.value}
            label={item.label}
            labelBelow
            size="sm"
          />
        ))}
      </div>
    </div>
  );
}
