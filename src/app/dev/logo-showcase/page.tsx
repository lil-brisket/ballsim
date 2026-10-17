"use client";

/**
 * Dev-only visual QA page for the full franchise logo catalog.
 * Visit /dev/logo-showcase while running `npm run dev` to review all 52 marks.
 */

import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import {
  TEAM_LOGO_CATALOG,
  TEAM_LOGO_CATEGORIES,
  getLogosByCategory,
} from "@/data/team-branding/logo-catalog";
import { SectionHeading } from "@/components/ui/SectionHeading";

const PREVIEW = {
  primaryColor: "#0B1F3A",
  secondaryColor: "#C4CED4",
  accentColor: "#F5B800",
};

export default function LogoShowcasePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <SectionHeading as="h1" size="lg" title="Franchise Logo Showcase" />
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Visual QA for all {TEAM_LOGO_CATALOG.length} catalog logos. Review
        silhouette distinction, weight, and readability at small sizes. Not
        linked from production navigation.
      </p>

      <div className="mt-8 space-y-10">
        {TEAM_LOGO_CATEGORIES.map((category) => {
          const logos = getLogosByCategory(category.id);
          return (
            <section key={category.id}>
              <SectionHeading
                title={`${category.label} (${logos.length})`}
                className="mb-3"
              />
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                {logos.map((logo) => (
                  <div
                    key={logo.id}
                    className="flex flex-col items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-2"
                  >
                    <TeamLogoMark
                      logoId={logo.id}
                      primaryColor={PREVIEW.primaryColor}
                      secondaryColor={PREVIEW.secondaryColor}
                      accentColor={PREVIEW.accentColor}
                      className="h-12 w-12"
                      title={logo.label}
                    />
                    <span className="text-center text-sm text-zinc-400">
                      {logo.label}
                    </span>
                    <span className="text-center text-sm text-zinc-500">
                      {logo.id}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
