import { StatusBadge } from "@/components/ui/StatusBadge";

const INJURY_TONES = new Set([
  "available",
  "minor",
  "questionable",
  "limited",
  "recovery",
  "out",
  "suspended",
  "injured",
]);

export function InjuryBadge(props: {
  status: string;
  label?: string;
}) {
  const tone = INJURY_TONES.has(props.status) ? props.status : "info";
  return <StatusBadge label={props.label ?? props.status} tone={tone} />;
}
