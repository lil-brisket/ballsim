import Link from "next/link";
import {
  TableKeys,
  tableCellTargetClass,
} from "@/components/ui/focus/TableKeys";
import { cn, focusRingClass } from "@/components/ui/styles";

export type DataTableHeader = {
  label: string;
  /** Right-aligns the column; pair cells with `numericCellClass`. */
  numeric?: boolean;
  /** Makes the header a sort control. `direction` is the current sort. */
  sort?: {
    href?: string;
    onSelect?: () => void;
    direction?: "asc" | "desc" | null;
  };
};

/** Classes for `<td>`s in a numeric column. */
export const numericCellClass = "text-right tabular-nums";

function ariaSort(
  direction: "asc" | "desc" | null | undefined,
): "ascending" | "descending" | "none" {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

function SortControl(props: {
  label: string;
  numeric?: boolean;
  sort: NonNullable<DataTableHeader["sort"]>;
}) {
  const { sort } = props;
  const className = cn(
    "inline-flex min-h-11 items-center gap-1 touch-manipulation hover:text-ink",
    props.numeric && "flex-row-reverse",
    focusRingClass,
  );
  const content = (
    <>
      {props.label}
      <span
        aria-hidden
        className={cn(
          "text-xs",
          sort.direction ? "text-team-ink" : "text-faint",
        )}
      >
        {sort.direction === "asc" ? "▲" : sort.direction === "desc" ? "▼" : "⇅"}
      </span>
    </>
  );
  if (sort.href) {
    return (
      <Link href={sort.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={sort.onSelect} className={className}>
      {content}
    </button>
  );
}

export function DataTable(props: {
  headers: Array<string | DataTableHeader>;
  children: React.ReactNode;
  caption?: string;
  /** CSS max-height; scrolls the table so the sticky header sticks. */
  maxHeight?: string;
}) {
  return (
    <TableKeys
      aria-label={props.caption ?? "Table"}
      className={cn(
        "rounded-xl border border-line",
        props.maxHeight ? "overflow-auto" : "overflow-x-auto",
      )}
      style={props.maxHeight ? { maxHeight: props.maxHeight } : undefined}
    >
      <table
        className={cn(
          "min-w-full text-left text-sm",
          "[&>tbody>tr:nth-child(even)]:bg-row-alt",
          tableCellTargetClass,
          "[&>tbody>tr:focus-within]:bg-surface-high [&>tbody>tr[aria-selected=true]]:bg-surface-high",
        )}
      >
        {props.caption ? (
          <caption className="sr-only">{props.caption}</caption>
        ) : null}
        <thead>
          <tr>
            {props.headers.map((raw) => {
              const header: DataTableHeader =
                typeof raw === "string" ? { label: raw } : raw;
              return (
                <th
                  key={header.label}
                  scope="col"
                  aria-sort={
                    header.sort ? ariaSort(header.sort.direction) : undefined
                  }
                  className={cn(
                    "sticky top-0 z-10 bg-surface-raised px-3 py-2 text-sm font-medium text-muted",
                    header.numeric && "text-right",
                  )}
                >
                  {header.sort ? (
                    <SortControl
                      label={header.label}
                      numeric={header.numeric}
                      sort={header.sort}
                    />
                  ) : (
                    header.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </TableKeys>
  );
}
