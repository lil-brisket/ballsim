import { ScoreNumeral } from "@/components/ui/ScoreNumeral";

export function StatTile(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-surface-line border-b-team-ink bg-surface-deep/80 px-3 py-3">
      <ScoreNumeral value={props.value} label={props.label} labelBelow />
    </div>
  );
}
