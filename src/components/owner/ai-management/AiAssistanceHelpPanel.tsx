"use client";

export function AiAssistanceHelpPanel() {
  return (
    <aside className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-sm text-zinc-400">
      <p className="font-medium text-zinc-200">How AI assistance works</p>
      <p className="mt-2 leading-relaxed">
        Choose the responsibilities you want to delegate. The AI will fully
        manage selected responsibilities while you retain control over
        everything else.
      </p>
      <p className="mt-2 leading-relaxed">
        Example: If you enable Injuries & Emergency Roster, the AI will
        automatically resolve roster problems caused by injuries during
        simulation.
      </p>
    </aside>
  );
}
