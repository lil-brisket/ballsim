import type { OwnerDashboardOwner } from "@/state/owner-dashboard";
import { ObjectiveCard } from "@/components/game/ObjectiveCard";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";

export function OwnerPanel(props: { owner: OwnerDashboardOwner }) {
  const { owner } = props;

  return (
    <Section title="Owner">
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Franchise reputation
          </p>
          <p className="mt-1 text-2xl font-mono text-zinc-50">
            {owner.franchiseReputation}
          </p>
        </div>

        {owner.priorities.length > 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
              Current priorities
            </p>
            <ul className="mt-2 space-y-1">
              {owner.priorities.map((priority) => (
                <li key={priority} className="text-sm text-zinc-300">
                  · {priority}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-300">Objectives</p>
          {owner.objectives.length === 0 ? (
            <EmptyState message="No objectives yet. Advance the season to generate them." />
          ) : (
            <ul className="space-y-2">
              {owner.objectives.map((objective) => (
                <ObjectiveCard
                  key={objective.id}
                  description={objective.description}
                  seasonYear={objective.seasonYear}
                  status={objective.status}
                  target={objective.target}
                  progress={objective.progress}
                  consequenceApplied={objective.consequenceApplied}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
