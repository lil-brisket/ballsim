/**
 * Dev-only visual QA page for the shared portrait library. Visit
 * /dev/portrait-library while running `npm run dev`. Shows every approved
 * library image the way PlayerPortrait renders it: a roster-sized row under
 * several team colour sets (same faces, only the jersey changes), every size,
 * and the full library. Not linked from production navigation.
 */

import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PortraitUniform } from "@/components/basketball/PortraitFace";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { PortraitLibraryEntry } from "@/domain/portrait-library";
import { PORTRAIT_LIBRARY } from "@/systems/portraits/portrait-library";

const TEAMS: Array<{ name: string; uniform: PortraitUniform | null }> = [
  { name: "No team (neutral)", uniform: null },
  {
    name: "Harbor Lights (navy / silver)",
    uniform: { primaryColor: "#0B1F3A", secondaryColor: "#C4CED4" },
  },
  {
    name: "Ember (red / gold)",
    uniform: { primaryColor: "#C8102E", secondaryColor: "#FDB927" },
  },
  {
    name: "Summit (white / blue)",
    uniform: { primaryColor: "#F4F4F5", secondaryColor: "#1D4ED8" },
  },
  {
    name: "Night Owls (black / purple)",
    uniform: { primaryColor: "#111111", secondaryColor: "#7C3AED" },
  },
  {
    name: "Neon Volts (lime / black)",
    uniform: { primaryColor: "#A3E635", secondaryColor: "#111111" },
  },
];

const SIZES = ["xs", "sm", "ms", "md", "lg", "xl"] as const;
const ROSTER_SIZE = 15;

function assignmentOf(entry: PortraitLibraryEntry): PlayerPortraitAssignment {
  return {
    version: 1,
    salt: 0,
    traits: { ears: 0, accessory: 0, ...entry.traits },
    libraryId: entry.id,
  };
}

function Portrait(props: {
  entry: PortraitLibraryEntry;
  size: (typeof SIZES)[number];
  uniform: PortraitUniform | null;
}) {
  return (
    <PlayerPortrait
      playerId={props.entry.id}
      firstName={props.entry.id}
      lastName=""
      size={props.size}
      portrait={assignmentOf(props.entry)}
      uniform={props.uniform}
    />
  );
}

export default function PortraitLibraryShowcase() {
  const entries = [...PORTRAIT_LIBRARY];
  if (entries.length === 0) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-ink">
        <h1 className="text-xl font-semibold">Portrait library</h1>
        <p className="mt-3 text-ink-muted">
          No approved portraits yet. Stage images with
          <code> npm run portraits:ingest</code>, review them, then run
          <code> npm run portraits:approve</code>.
        </p>
      </main>
    );
  }
  const roster = entries.slice(0, ROSTER_SIZE);
  return (
    <main className="mx-auto max-w-6xl space-y-10 p-6 text-ink">
      <header>
        <h1 className="text-xl font-semibold">Portrait library</h1>
        <p className="mt-1 text-ink-muted">
          {entries.length} approved images. Every row below uses the same faces;
          only the team colours change.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-semibold">One roster, six teams (md, 64px)</h2>
        {TEAMS.map((team) => (
          <div key={team.name}>
            <p className="mb-1 text-sm text-ink-muted">{team.name}</p>
            <div className="flex flex-wrap gap-2">
              {roster.map((entry) => (
                <Portrait
                  key={entry.id}
                  entry={entry}
                  size="md"
                  uniform={team.uniform}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Actual sizes, first four images</h2>
        {roster.slice(0, 4).map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-end gap-3">
            <span className="w-14 text-sm text-ink-muted">{entry.id}</span>
            {SIZES.map((size) => (
              <Portrait
                key={size}
                entry={entry}
                size={size}
                uniform={TEAMS[1]!.uniform}
              />
            ))}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">All images (lg, 96px)</h2>
        <div className="flex flex-wrap gap-3">
          {entries.map((entry) => (
            <figure key={entry.id} className="text-center text-xs">
              <Portrait entry={entry} size="lg" uniform={TEAMS[2]!.uniform} />
              <figcaption className="mt-1 text-ink-muted">
                {entry.id}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
