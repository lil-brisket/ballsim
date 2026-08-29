import Link from "next/link";
import type { PhaseDashboardView } from "@/state/phase-dashboard";
import { PhaseHeader } from "@/components/phase/PhaseHeader";
import { PhaseAttentionSummaryPanel } from "@/components/phase/PhaseAttentionSummary";
import {
  PhaseFocusList,
  PhaseTaskList,
} from "@/components/phase/PhaseFocusList";
import { MultiTeamPhaseSwitcher } from "@/components/phase/MultiTeamPhaseSwitcher";
import { AdvancePhaseDialog } from "@/components/phase/AdvancePhaseDialog";

export function PhaseDashboard(props: {
  view: PhaseDashboardView;
  saveId: string;
  returnPath: string;
  currentDate: string;
  seasonYear: number;
  advanceAction: (formData: FormData) => void | Promise<void>;
  dismissAction: (formData: FormData) => void | Promise<void>;
  switchTeamAction: (formData: FormData) => void | Promise<void>;
}) {
  const tasks = [
    ...props.view.attention.required,
    ...props.view.attention.recommended,
    ...props.view.attention.optional.slice(0, 3),
  ];

  return (
    <div className="space-y-4" aria-label="Phase command center">
      <PhaseHeader
        view={props.view}
        currentDate={props.currentDate}
        seasonYear={props.seasonYear}
      />
      <MultiTeamPhaseSwitcher
        teams={props.view.ownedTeams}
        saveId={props.saveId}
        returnPath={props.returnPath}
        switchAction={props.switchTeamAction}
      />
      <PhaseAttentionSummaryPanel attention={props.view.attention} />
      <PhaseFocusList focus={props.view.focus} />
      <PhaseTaskList
        tasks={tasks}
        saveId={props.saveId}
        returnPath={props.returnPath}
        dismissAction={props.dismissAction}
      />
      <section aria-label="Optional shortcuts">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
          Optional
        </p>
        <p className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-400">
          {props.view.optionalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border border-zinc-700 px-2 py-1 hover:border-zinc-500 hover:text-zinc-200"
            >
              {link.label}
            </Link>
          ))}
        </p>
      </section>
      <AdvancePhaseDialog
        view={props.view}
        saveId={props.saveId}
        returnPath={props.returnPath}
        advanceAction={props.advanceAction}
      />
    </div>
  );
}
