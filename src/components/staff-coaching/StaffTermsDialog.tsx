"use client";

import { useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import { cn, focusRingClass } from "@/components/ui/styles";
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
      <button
        type="button"
        onClick={() => {
          setAnnualSalary(props.defaultAnnualSalary);
          setYears(props.defaultYears);
          setOpen(true);
        }}
        className={cn(
          "rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-1.5 text-sm text-amber-300 hover:border-amber-600",
          focusRingClass,
          props.triggerClassName,
        )}
      >
        {props.triggerLabel}
      </button>
      {open ? (
        <Overlay
          className="flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-terms-dialog-title"
            className="relative z-10 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="staff-terms-dialog-title"
              className="text-lg font-medium text-zinc-50"
            >
              {props.title}
            </h3>
            {props.askingSalary !== undefined ? (
              <p className="mt-2 text-sm text-zinc-400">
                Requested salary{" "}
                <MoneyDisplay amount={props.askingSalary} />
              </p>
            ) : null}
            {props.interestLevel ? (
              <p className="mt-1 text-sm text-zinc-400">
                Staff interest:{" "}
                <span className="capitalize text-zinc-200">
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
              <label className="block text-sm text-zinc-300">
                Annual salary
                <input
                  type="number"
                  name="annualSalary"
                  min={0}
                  step={10000}
                  value={annualSalary}
                  onChange={(event) =>
                    setAnnualSalary(Number(event.target.value) || 0)
                  }
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                Contract length (years)
                <input
                  type="number"
                  name="years"
                  min={1}
                  max={10}
                  value={years}
                  onChange={(event) =>
                    setYears(Number(event.target.value) || 1)
                  }
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100"
                />
              </label>
              {props.showTotalPreview ? (
                <p className="text-sm text-zinc-400">
                  New contract{" "}
                  <MoneyDisplay amount={total} /> total
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500",
                    focusRingClass,
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cn(
                    "rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500",
                    focusRingClass,
                  )}
                >
                  {props.submitLabel}
                </button>
              </div>
            </form>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
