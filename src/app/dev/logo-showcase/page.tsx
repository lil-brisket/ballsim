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

const PREVIEW = {
  primaryColor: "#0B1F3A",
  secondaryColor: "#C4CED4",
  accentColor: "#F5B800",
};

export default function LogoShowcasePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <h1 className="text-2xl font-semibold tracking-tight text-amber-500">
        Franchise Logo Showcase
      </h1>
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
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-500">
                {category.label}{" "}
                <span className="text-zinc-500">({logos.length})</span>
              </h2>
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
                    <span className="text-center text-[10px] text-zinc-400">
                      {logo.label}
                    </span>
                    <span className="text-center font-mono text-[9px] text-zinc-600">
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
