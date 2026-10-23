import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PlayerMoodView } from "@/state/player-mood-selectors";

const BAND_TONE: Record<PlayerMoodView["band"], string> = {
  happy: "success",
  content: "neutral",
  unhappy: "warning",
  upset: "critical",
};

export function MoodChip(props: { mood: PlayerMoodView }) {
  const { mood } = props;
  const description = `${mood.label}: ${mood.reason}`;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1"
      data-mood-band={mood.band}
      title={description}
      aria-label={description}
      role="group"
    >
      <StatusBadge label={mood.label} tone={BAND_TONE[mood.band]} />
      {mood.tradeRequested ? (
        <StatusBadge label="Trade request" tone="critical" />
      ) : null}
    </span>
  );
}
