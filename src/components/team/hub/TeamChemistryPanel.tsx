import { Gauge } from "@/components/ui/Gauge";
import { Section } from "@/components/ui/Section";
import type { TeamChemistryView } from "@/state/team-hub-selectors";

/**
 * Team chemistry gauge with what drives it. Presentation only.
 */
export function TeamChemistryPanel(props: { chemistry: TeamChemistryView }) {
  const { chemistry } = props;
  return (
    <Section title="Chemistry">
      <div className="flex flex-wrap items-center gap-4">
        <Gauge label={`Chemistry ${chemistry.label}`} value={chemistry.value} />
        <div className="min-w-0 flex-1 space-y-1 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">{chemistry.label}</p>
          <p>
            {Math.round(chemistry.continuity * 100)}% of the core rotation
            played here last season.
          </p>
          {chemistry.note ? (
            <p className="text-warning">{chemistry.note}</p>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
