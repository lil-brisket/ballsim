"use client";

import { useEffect, useId, useRef, useState } from "react";
import { restrictedFreeAgencyAction } from "@/application/actions";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Button } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Overlay } from "@/components/ui/Overlay";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { RfaTag } from "@/state/rfa-selectors";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const SALARY_STEP = 100_000;
const MAX_YEARS = 5;

/**
 * Market action for a restricted free agent: replaces Sign/Offer. Presentation
 * only; the sheet is validated in restrictedFreeAgencyAction.
 */
export function RfaOfferSheetAction(props: {
  saveId: string;
  playerId: string;
  playerName: string;
  returnPath: string;
  tag: RfaTag;
}) {
  const { tag } = props;
  const [open, setOpen] = useState(false);
  const [years, setYears] = useState(2);
  const [salary, setSalary] = useState(tag.qualifyingOfferSalary);
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

  if (tag.pendingMatch) {
    return (
      <span className="text-sm text-zinc-400">
        Waiting on {tag.originalTeamName}
      </span>
    );
  }

  const validYears =
    Number.isInteger(years) && years >= 1 && years <= MAX_YEARS;
  const validSalary =
    Number.isFinite(salary) && salary >= tag.qualifyingOfferSalary;

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        className="min-h-9 px-2.5"
        onClick={() => {
          setYears(2);
          setSalary(tag.qualifyingOfferSalary);
          setOpen(true);
        }}
      >
        Offer sheet
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
            className="relative z-10 max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-left shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <SectionHeading
              as="h3"
              id={titleId}
              title={`Offer sheet for ${props.playerName}`}
            />
            <form
              action={restrictedFreeAgencyAction}
              className="mt-3 space-y-4"
            >
              <input type="hidden" name="saveId" value={props.saveId} />
              <input type="hidden" name="playerId" value={props.playerId} />
              <input type="hidden" name="returnPath" value={props.returnPath} />
              <input type="hidden" name="intent" value="offer_sheet" />
              <p className="text-sm text-zinc-400">
                {tag.originalTeamName} can match this sheet. If they do not, he
                joins you.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={yearsId} className="text-sm text-zinc-400">
                    Seasons
                  </label>
                  <div>
                    <NumberStepper
                      id={yearsId}
                      name="years"
                      value={years}
                      onValueChange={setYears}
                      min={1}
                      max={MAX_YEARS}
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
                      min={tag.qualifyingOfferSalary}
                      step={SALARY_STEP}
                      required
                      inputClassName="w-28"
                    />
                    {validSalary ? <MoneyDisplay amount={salary} /> : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!validYears || !validSalary}
                >
                  Sign offer sheet
                </Button>
              </div>
            </form>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
