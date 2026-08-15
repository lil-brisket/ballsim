import { StatusBadge } from "@/components/owner/StatusBadge";

export function PhaseBadge(props: {
  seasonPhase: string;
  offseasonStage?: string;
}) {
  const stage =
    props.offseasonStage && props.offseasonStage !== "none"
      ? ` / ${props.offseasonStage.replaceAll("_", " ")}`
      : "";
  const label = `${props.seasonPhase}${stage}`;
  return <StatusBadge label={label} tone="info" />;
}
