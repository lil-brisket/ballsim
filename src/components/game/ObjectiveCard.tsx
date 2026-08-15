import { StatusBadge } from "@/components/owner/StatusBadge";

export function ObjectiveCard(props: {
  description: string;
  seasonYear: number;
  status: string;
  target: number | null;
  progress: number | null;
  consequenceApplied: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div>
        <p className="text-zinc-100">{props.description}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {props.seasonYear}
          {props.target !== null ? ` · target ${props.target}` : ""}
          {props.progress !== null ? ` · progress ${props.progress}` : ""}
          {props.consequenceApplied ? " · consequence applied" : ""}
        </p>
      </div>
      <StatusBadge label={props.status} tone={props.status} />
    </li>
  );
}
