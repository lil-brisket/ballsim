"use client";

export function AiAssistanceHelpPanel() {
  return (
    <aside className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-sm text-zinc-400">
      <p className="font-medium text-zinc-200">How AI assistance works</p>
      <p className="mt-2 leading-relaxed">
        Delegation controls who acts automatically during simulation. It does
        not lock what you can do manually — you can always open any management
        screen and make adjustments yourself.
      </p>
      <p className="mt-2 leading-relaxed">
        Example: If you enable Injuries & Emergency Roster, the AI resolves
        injury roster problems during simulation. You can still sign or release
        players anytime. Simulation pauses only for meaningful owner decisions,
        such as incoming trade offers.
      </p>
    </aside>
  );
}
