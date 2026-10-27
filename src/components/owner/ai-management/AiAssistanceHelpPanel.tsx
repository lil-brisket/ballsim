"use client";

/** Help copy for AI delegation; rendered inside an InfoTip popover. */
export function AiAssistanceHelpPanel() {
  return (
    <>
      <span className="block font-medium text-ink">
        How AI assistance works
      </span>
      <span className="mt-1 block">
        Pick the areas the AI manages during simulation. Anything you leave off
        stays under your control.
      </span>
      <span className="mt-2 block">
        Delegation does not lock what you can do manually — you can always open
        any management screen and make adjustments yourself.
      </span>
      <span className="mt-2 block">
        Simulation pauses only for meaningful owner decisions, such as incoming
        trade offers.
      </span>
    </>
  );
}
