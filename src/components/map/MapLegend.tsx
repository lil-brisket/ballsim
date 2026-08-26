export function MapLegend(props: { showOccupied?: boolean }) {
  return (
    <ul className="flex shrink-0 flex-wrap gap-4 text-xs text-zinc-400">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
        Available
      </li>
      {props.showOccupied ? (
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-500" aria-hidden />
          Occupied
        </li>
      ) : null}
      <li className="flex items-center gap-1.5">
        <span
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300 bg-amber-500"
          aria-hidden
        />
        Selected
      </li>
    </ul>
  );
}
