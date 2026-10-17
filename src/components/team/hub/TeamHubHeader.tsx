import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { TeamHubView } from "@/state/team-hub-selectors";

/**
 * Team Hub title. Team identity, record and league rank live in the game
 * header, so this only adds what the header does not show: form and phase.
 * Carries the faded team-logo watermark for the team pages.
 */
export function TeamHubHeader(props: { hub: TeamHubView }) {
  const { hub } = props;
  const context = [
    hub.recentForm.streak ? `Streak ${hub.recentForm.streak}` : null,
    hub.offseasonStage !== "none"
      ? `${hub.seasonPhase} / ${hub.offseasonStage}`
      : hub.seasonPhase,
  ].filter(Boolean);
  return (
    <ArenaPanel
      as="header"
      hero
      texture
      edge="top"
      watermark={hub.branding}
      density="comfortable"
      className="space-y-2"
    >
      <SectionHeading as="h1" size="lg" title="Team Hub" />
      <p className="text-sm text-zinc-300">{context.join(" · ")}</p>
    </ArenaPanel>
  );
}
