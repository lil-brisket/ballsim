"use client";

import { useEffect, useId, useRef, useState } from "react";
import { offerContractExtensionAction } from "@/application/actions";
import { formatMoney, MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Button } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Overlay } from "@/components/ui/Overlay";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/components/ui/styles";
import type { ContractExtensionView } from "@/state/contract-extension-selectors";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const SALARY_STEP = 100_000;

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function defaultYears(extension: ContractExtensionView): number {
  return Math.min(Math.max(extension.askMinYears, 2), extension.maxYears);
}

/**
 * Owner contract extension negotiation sheet. Presentation only: the offer is
 * evaluated in offerContractExtensionAction.
 */
export function ExtendContractDialog(props: {
  saveId: string;
  playerId: string;
  playerName: string;
  returnPath: string;
  extension: ContractExtensionView;
  /** Open on mount (deep link from the player drawer). */
  defaultOpen?: boolean;
}) {
  const { extension } = props;
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [years, setYears] = useState(() => defaultYears(extension));
  const [salary, setSalary] = useState(extension.askSalary);
  const titleId = useId();
  const yearsId = useId();
  const salaryId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const blocked = extension.blockedReason !== null;
  const validYears = Number.isInteger(years) && years >= 1;
  const validSalary = Number.isFinite(salary) && salary > 0;
  const response = extension.lastResponse;
  const rows = Array.from({ length: validYears ? years : 0 }, (_, index) => {
    const seasonYear = extension.firstNewSeason + index;
    const base = extension.seasons.find((s) => s.seasonYear === seasonYear);
    const payroll =
      (base?.payrollWithoutPlayer ?? 0) + (validSalary ? salary : 0);
    return { seasonYear, payroll, room: extension.salaryCap - payroll };
  });

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        className="min-h-9 px-2.5"
        onClick={() => {
          setYears(defaultYears(extension));
          setSalary(extension.askSalary);
          setOpen(true);
        }}
      >
        Extend
      </Button>
      {open ? (
        <Overlay
          className="flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 max-h-full w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-left shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <SectionHeading
              as="h3"
              id={titleId}
              title={`Extend ${props.playerName}`}
            />
            <form
              action={offerContractExtensionAction}
              className="mt-3 space-y-4"
            >
              <input type="hidden" name="saveId" value={props.saveId} />
              <input type="hidden" name="playerId" value={props.playerId} />
              <input type="hidden" name="returnPath" value={props.returnPath} />

              <div className="space-y-1 text-sm">
                <p className="text-zinc-300">
                  Current deal: {formatMoney(extension.currentSalary)} a season,{" "}
                  {extension.seasonsLeft === 0
                    ? "ends this offseason"
                    : `${plural(extension.seasonsLeft, "season")} left`}
                  .
                </p>
                <p className="text-zinc-400">
                  He is looking for about {formatMoney(extension.askSalary)} a
                  season for at least {plural(extension.askMinYears, "season")}.
                </p>
              </div>

              {response && response.kind !== "accept" ? (
                <div className="space-y-2 rounded-md border border-zinc-700 p-3 text-sm text-zinc-300">
                  {response.kind === "counter" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p>
                        He countered: {formatMoney(response.askSalary)} for{" "}
                        {plural(response.askYears, "season")}.
                      </p>
                      <Button
                        variant="secondary"
                        className="min-h-9 px-2.5"
                        onClick={() => {
                          setSalary(response.askSalary);
                          setYears(
                            Math.min(
                              Math.max(response.askYears, 1),
                              extension.maxYears,
                            ),
                          );
                        }}
                      >
                        Use his terms
                      </Button>
                    </div>
                  ) : (
                    <p>
                      He turned down {formatMoney(response.offeredSalary)} for{" "}
                      {plural(response.offeredYears, "season")}.
                    </p>
                  )}
                  {extension.testingMarket ? (
                    <p className="text-rose-300">
                      He has decided to test free agency.
                    </p>
                  ) : null}
                </div>
              ) : extension.testingMarket ? (
                <p className="text-sm text-rose-300">
                  He has decided to test free agency.
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={yearsId} className="text-sm text-zinc-400">
                    Added seasons
                  </label>
                  <div>
                    <NumberStepper
                      id={yearsId}
                      name="years"
                      value={years}
                      onValueChange={setYears}
                      min={1}
                      max={extension.maxYears}
                      step={1}
                      required
                      inputClassName="w-12"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor={salaryId} className="text-sm text-zinc-400">
                    Salary per season
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <NumberStepper
                      id={salaryId}
                      name="salary"
                      value={salary}
                      onValueChange={setSalary}
                      min={extension.minSalary}
                      max={extension.maxSalary}
                      step={SALARY_STEP}
                      required
                      inputClassName="w-28"
                    />
                    {validSalary ? <MoneyDisplay amount={salary} /> : null}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[18rem] text-sm">
                  <thead>
                    <tr className="text-left text-zinc-400">
                      <th className="py-1 pr-3 font-medium">Season</th>
                      <th className="py-1 pr-3 font-medium">Payroll after</th>
                      {extension.salaryCapEnabled ? (
                        <th className="py-1 font-medium">Cap room</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.seasonYear}
                        className="border-t border-zinc-800"
                      >
                        <td className="py-1 pr-3">{row.seasonYear}</td>
                        <td className="py-1 pr-3">
                          <MoneyDisplay amount={row.payroll} />
                        </td>
                        {extension.salaryCapEnabled ? (
                          <td
                            className={cn(
                              "py-1",
                              row.room < 0 && "text-rose-300",
                            )}
                          >
                            <MoneyDisplay amount={row.room} />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {blocked ? (
                <p role="alert" className="text-sm text-rose-300">
                  {extension.blockedReason}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={blocked || !validYears || !validSalary}
                >
                  Offer extension
                </Button>
              </div>
            </form>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
