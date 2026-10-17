/**
 * Dev-only visual QA page for the shared UI primitives in src/components/ui.
 * Visit /dev/broadcast-ui while running `npm run dev`. Every primitive renders
 * side by side under a very dark and a very light fictional team so
 * team-colour contrast can be checked. Not linked from production navigation.
 */

import { SectionHeading, TeamThemeScope } from "@/components/ui";
import { CourtShowcase } from "./CourtShowcase";
import { TeamShowcase } from "./TeamShowcase";

const TEAMS = [
  {
    label: "Very dark primary",
    city: "Harbor",
    name: "Harriers",
    abbreviation: "HAR",
    branding: {
      primaryColor: "#0B1F3A",
      secondaryColor: "#C4CED4",
      accentColor: "#F5B800",
      logoId: "wolf",
    },
  },
  {
    label: "Very light primary",
    city: "Summit",
    name: "Glaciers",
    abbreviation: "SUM",
    branding: {
      primaryColor: "#F2F0E6",
      secondaryColor: "#1D6B44",
      accentColor: "#C8102E",
      logoId: "eagle",
    },
  },
] as const;

export default function BroadcastUiShowcasePage() {
  return (
    <main className="min-h-screen bg-surface-deep px-4 py-8 text-zinc-100 sm:px-6">
      <SectionHeading
        as="h1"
        size="lg"
        eyebrow="Dev / visual QA"
        title="Shared UI primitives"
      />
      <p className="mt-3 max-w-2xl text-sm text-zinc-400">
        Every primitive under a very dark and a very light team colour. Toggle
        the OS reduced-motion setting to confirm animations stop.
      </p>

      <TeamThemeScope
        branding={TEAMS[0].branding}
        as="section"
        className="mt-10 max-w-xl space-y-3"
      >
        <SectionHeading
          as="h2"
          eyebrow="Court replay"
          title="Dark home vs light away"
        />
        <CourtShowcase />
      </TeamThemeScope>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {TEAMS.map((team) => (
          <TeamThemeScope
            key={team.label}
            branding={team.branding}
            as="section"
            className="min-w-0 space-y-6"
          >
            <SectionHeading
              as="h2"
              eyebrow={team.label}
              title={`${team.city} ${team.name}`}
            />
            <TeamShowcase
              city={team.city}
              name={team.name}
              abbreviation={team.abbreviation}
              branding={team.branding}
            />
          </TeamThemeScope>
        ))}
      </div>
    </main>
  );
}
