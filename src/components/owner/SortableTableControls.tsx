"use client";

export function SortableTableControls<T extends string>(props: {
  sortKey: T;
  sortDir: "asc" | "desc";
  options: readonly { value: T; label: string }[];
  onSortKeyChange: (key: T) => void;
  onSortDirChange: (dir: "asc" | "desc") => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  queryPlaceholder?: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {props.onQueryChange ? (
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Filter
          <input
            type="search"
            value={props.query ?? ""}
            onChange={(event) => props.onQueryChange?.(event.target.value)}
            placeholder={props.queryPlaceholder ?? "Search…"}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Sort by
        <select
          value={props.sortKey}
          onChange={(event) => props.onSortKeyChange(event.target.value as T)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Direction
        <select
          value={props.sortDir}
          onChange={(event) =>
            props.onSortDirChange(event.target.value as "asc" | "desc")
          }
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </label>
    </div>
  );
}
