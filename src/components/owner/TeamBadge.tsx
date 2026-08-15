export function TeamBadge(props: {
  city: string;
  name: string;
  abbreviation: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-700/40 bg-amber-950/50 font-mono text-xs font-semibold text-amber-400">
        {props.abbreviation}
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-100">
          {props.city} {props.name}
        </p>
        <p className="font-mono text-xs text-zinc-500">{props.abbreviation}</p>
      </div>
    </div>
  );
}
