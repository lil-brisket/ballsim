import { StatusBadge } from "@/components/owner/StatusBadge";

export function ObjectiveCard(props: {
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
    meta.push(`target ${props.target}`);
  }
  if (props.progress !== null) {
    meta.push(`progress ${props.progress}`);
  }
  if (props.consequenceApplied) {
    meta.push("consequence applied");
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div>
        <p className="text-zinc-100">{props.description}</p>
        <p className="mt-1 text-xs text-zinc-500">{meta.join(" · ")}</p>
      </div>
      <StatusBadge label={props.status} tone={props.status} />
    </li>
  );
}
