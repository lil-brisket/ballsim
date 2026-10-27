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
        <Gauge
          label={`Chemistry ${chemistry.label}`}
          value={chemistry.value}
          hideLabel
        />
        <div className="min-w-0 flex-1 space-y-1 text-sm text-soft">
          <p className="font-medium text-ink">{chemistry.label}</p>
          <p>
            {chemistry.continuityKnown
              ? `${Math.round(chemistry.continuity * 100)}% of the core rotation played here last season.`
              : "First season together."}
          </p>
          {chemistry.note ? (
            <p className="text-warning">{chemistry.note}</p>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
