import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatObjectiveValue } from "@/domain/owner-objective-text";

export function ObjectiveCard(props: {
  /** Objective type; sets the unit of target and progress ($, %). */
  type: string;
  description: string;
  seasonYear: number;
  status: string;
  role?: string | null;
  lifecycle?: string | null;
  target: number | null;
  progress: number | null;
  consequenceApplied: boolean;
}) {
  const meta: string[] = [String(props.seasonYear)];
  if (props.role) {
    meta.push(props.role.replaceAll("_", " "));
  }
  if (props.lifecycle) {
    meta.push(props.lifecycle.replaceAll("_", " "));
  }
  if (props.target !== null) {
    meta.push(`target ${formatObjectiveValue(props.type, props.target)}`);
  }
  if (props.progress !== null) {
    meta.push(`progress ${formatObjectiveValue(props.type, props.progress)}`);
  }
  if (props.consequenceApplied) {
    meta.push("consequence applied");
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-raised/50 px-4 py-3">
      <div>
        <p className="text-ink">{props.description}</p>
        <p className="mt-1 text-sm text-faint">{meta.join(" · ")}</p>
      </div>
      <StatusBadge label={props.status} tone={props.status} />
    </li>
  );
}
