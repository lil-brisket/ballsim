"use client";

import { Button } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";

/**
 * Presentation-only terms overlay. Mutation happens via the server-action form
 * after submit — not a second entity drawer.
 */
export function StaffTermsDialog(props: {
  title: string;
  triggerLabel: string;
  submitLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  saveId: string;
  returnPath: string;
  hiddenFields: Record<string, string>;
  defaultAnnualSalary: number;
  defaultYears: number;
  askingSalary?: number;
  interestLevel?: string;
  showTotalPreview?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [annualSalary, setAnnualSalary] = useState(props.defaultAnnualSalary);
  const [years, setYears] = useState(props.defaultYears);
  const total = annualSalary * years;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setAnnualSalary(props.defaultAnnualSalary);
          setYears(props.defaultYears);
          setOpen(true);
        }}
        className={props.triggerClassName}
      >
        {props.triggerLabel}
      </Button>
      {open ? (
        <Overlay
          className="flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-terms-dialog-title"
            className="relative z-10 w-full max-w-md rounded-xl border border-line-strong bg-surface-raised p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="staff-terms-dialog-title"
              className="text-lg font-medium text-ink"
            >
              {props.title}
            </h3>
            {props.askingSalary !== undefined ? (
              <p className="mt-2 text-sm text-muted">
                Requested salary <MoneyDisplay amount={props.askingSalary} />
              </p>
            ) : null}
            {props.interestLevel ? (
              <p className="mt-1 text-sm text-muted">
                Staff interest:{" "}
                <span className="capitalize text-ink">
                  {props.interestLevel}
                </span>
              </p>
            ) : null}
            <form action={props.action} className="mt-4 space-y-3">
              <input type="hidden" name="saveId" value={props.saveId} />
              <input type="hidden" name="returnPath" value={props.returnPath} />
              {Object.entries(props.hiddenFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <div className="text-sm text-soft">
                <label htmlFor="staff-terms-annual-salary">Annual salary</label>
                <NumberStepper
                  id="staff-terms-annual-salary"
                  name="annualSalary"
                  min={0}
                  step={10000}
                  value={annualSalary}
                  onValueChange={setAnnualSalary}
                  className="mt-1 flex"
                  inputClassName="w-full min-w-28 flex-1"
                />
              </div>
              <div className="text-sm text-soft">
                <label htmlFor="staff-terms-years">
                  Contract length (years)
                </label>
                <NumberStepper
                  id="staff-terms-years"
                  name="years"
                  min={1}
                  max={10}
                  value={years}
                  onValueChange={setYears}
                  className="mt-1 flex"
                  inputClassName="w-full min-w-28 flex-1"
                />
              </div>
              {props.showTotalPreview ? (
                <p className="text-sm text-muted">
                  New contract <MoneyDisplay amount={total} /> total
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {props.submitLabel}
                </Button>
              </div>
            </form>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
