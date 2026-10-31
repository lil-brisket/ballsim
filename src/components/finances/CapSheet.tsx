import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { DataTable, numericCellClass } from "@/components/ui/DataTable";
import { cn } from "@/components/ui/styles";
import type {
  CapSheetCell,
  CapSheetLine,
  CapSheetRow,
  CapSheetView,
} from "@/state/cap-sheet-selectors";

const HEADROOM = 1.1;

/** "$4.0M under the cap", "$2.1M over the tax line", "$1.0M above the floor". */
function lineStatus(line: CapSheetLine): string {
  const amount = formatMoney(Math.abs(line.delta));
  if (line.key === "floor") {
    return line.delta >= 0
      ? `${amount} above the floor`
      : `${amount} below the floor`;
  }
  const what = line.key === "cap" ? "the cap" : "the tax line";
  return line.delta > 0 ? `${amount} over ${what}` : `${amount} under ${what}`;
}

function isBad(line: CapSheetLine): boolean {
  return line.key === "floor" ? line.delta < 0 : line.delta > 0;
}

function barSummary(view: CapSheetView): string {
  const parts = [`Payroll ${formatMoney(view.payroll)}`];
  for (const line of view.lines) {
    parts.push(
      `${line.label} ${formatMoney(line.amount)}: ${lineStatus(line)}`,
    );
  }
  return parts.join(". ");
}

/** Absolutely positioned child of the bar track; position is a percentage. */
function BarMarker(props: { percent: number }) {
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 w-0.5 bg-ink"
      style={{ left: `${props.percent}%` }}
    />
  );
}

function BarLabel(props: { percent: number; children: React.ReactNode }) {
  const alignRight = props.percent > 60;
  return (
    <div
      aria-hidden
      className="relative h-5 text-sm whitespace-nowrap text-soft"
    >
      <span
        className="absolute top-0"
        style={
          alignRight
            ? { right: `${100 - props.percent}%`, paddingRight: 4 }
            : { left: `${props.percent}%`, paddingLeft: 4 }
        }
      >
        {props.children}
      </span>
    </div>
  );
}

function PayrollBar(props: { view: CapSheetView }) {
  const { view } = props;
  const max =
    Math.max(view.payroll, ...view.lines.map((line) => line.amount), 1) *
    HEADROOM;
  const pct = (value: number) => Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div
        role="img"
        aria-label={barSummary(view)}
        className="space-y-1 overflow-hidden"
      >
        <div className="relative h-8 rounded-md bg-surface-high">
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-md bg-team"
            style={{ width: `${pct(view.payroll)}%` }}
          />
          {view.lines.map((line) => (
            <BarMarker key={line.key} percent={pct(line.amount)} />
          ))}
        </div>
        <BarLabel percent={0}>
          <span className="font-medium text-ink">
            Payroll {formatMoney(view.payroll)}
          </span>
        </BarLabel>
        {view.lines.map((line) => (
          <BarLabel key={line.key} percent={pct(line.amount)}>
            {line.label} {formatMoney(line.amount)}
          </BarLabel>
        ))}
      </div>
      <ul className="space-y-0.5 text-sm text-soft">
        {view.lines.map((line) => (
          <li key={line.key}>
            <span className="text-muted">{line.label}:</span>{" "}
            <span className={cn(isBad(line) && "text-danger")}>
              {lineStatus(line)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CapCell(props: { cell: CapSheetCell; row: CapSheetRow }) {
  const { cell, row } = props;
  const muted = row.kind === "development_league";
  switch (cell.kind) {
    case "empty":
      return <span className="text-faint">—</span>;
    case "salary":
      return (
        <span className={cn(muted && "text-muted")}>
          {formatMoney(cell.amount)}
        </span>
      );
    case "dead":
      return (
        <span>
          {formatMoney(cell.amount)}
          <span title="Dead money" className="ml-0.5">
            †
          </span>
        </span>
      );
    case "option": {
      const label = cell.option === "team" ? "Team option" : "Player option";
      return (
        <span className="text-muted italic">
          {formatMoney(cell.amount)}{" "}
          <abbr title={label} className="text-sm no-underline">
            {cell.option === "team" ? "TO" : "PO"}
          </abbr>
          <span className="sr-only"> ({label}, pending, not counted)</span>
        </span>
      );
    }
  }
}

function TotalCell(props: { total: CapSheetView["totals"][number] }) {
  const { total } = props;
  return (
    <>
      <div>{formatMoney(total.payroll)}</div>
      {total.cap !== null && total.room !== null ? (
        <div className="text-sm font-normal text-muted">
          Cap {formatMoney(total.cap)} ·{" "}
          {total.room >= 0
            ? `Room ${formatMoney(total.room)}`
            : `Over by ${formatMoney(-total.room)}`}
        </div>
      ) : null}
    </>
  );
}

export function CapSheet(props: { view: CapSheetView; saveId: string }) {
  const { view, saveId } = props;
  const headers = [
    "Player",
    ...view.seasons.map((season) => ({
      label: String(season),
      numeric: true,
    })),
  ];
  return (
    <div className="space-y-3">
      <PayrollBar view={view} />
      <DataTable caption="Cap sheet" headers={headers}>
        {view.rows.map((row) => (
          <tr
            key={row.key}
            className={cn(row.kind === "development_league" && "text-muted")}
          >
            {/* No wrapping: the grid scrolls sideways on phones instead. */}
            <td className="whitespace-nowrap px-3 py-2">
              <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
                {row.name}
              </PlayerEntityLink>
              {row.position ? (
                <span className="ml-2 text-sm text-muted">{row.position}</span>
              ) : null}
              {row.note ? (
                <span className="ml-2 text-sm text-muted">{row.note}</span>
              ) : null}
            </td>
            {row.cells.map((cell, index) => (
              <td
                key={view.seasons[index]}
                className={cn("whitespace-nowrap px-3 py-2", numericCellClass)}
              >
                <CapCell cell={cell} row={row} />
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-line font-semibold text-ink">
          <th scope="row" className="px-3 py-2 text-left font-semibold">
            Payroll
          </th>
          {view.totals.map((total) => (
            <td
              key={total.season}
              className={cn(
                "whitespace-nowrap px-3 py-2 align-top",
                numericCellClass,
              )}
            >
              <TotalCell total={total} />
            </td>
          ))}
        </tr>
      </DataTable>
      <p className="text-sm text-muted">
        <abbr title="Team option">TO</abbr> team option and{" "}
        <abbr title="Player option">PO</abbr> player option: shown in italics,
        pending and not counted in payroll. † dead money from released players,
        counted in payroll. Development league players are muted and not counted
        in payroll.
      </p>
    </div>
  );
}
