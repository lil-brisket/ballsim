import { StatusBadge } from "@/components/ui/StatusBadge";

export function ContractSummary(props: {
  salary: number | null;
  endYear: number | null;
  yearsRemaining?: number | null;
  status?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-soft">
      <span className="font-mono">
        {props.salary !== null
          ? `$${(props.salary / 1_000_000).toFixed(1)}M`
          : "—"}
      </span>
      {props.yearsRemaining !== null && props.yearsRemaining !== undefined ? (
        <span className="text-faint">{props.yearsRemaining}y</span>
      ) : props.endYear !== null ? (
        <span className="text-faint">thru {props.endYear}</span>
      ) : null}
      {props.status ? <StatusBadge label={props.status} /> : null}
    </div>
  );
}
