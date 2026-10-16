/**
 * Dev-only visual QA page for the broadcast / arena UI primitives.
 * Visit /dev/broadcast-ui while running `npm run dev`. Each primitive renders
 * under the default amber theme, a very dark team and a very light team so
 * team-colour contrast can be checked. Not linked from production navigation.
 */

import { PlayerProfileHero } from "@/components/basketball/PlayerProfileHero";
import {
  ArenaPanel,
  RatingBars,
  ScoreNumeral,
  SectionHeading,
  TeamBadge,
  TeamThemeScope,
  TickerBar,
  focusRingClass,
  touchTargetClass,
  cn,
} from "@/components/ui";

const THEMES = [
  {
    label: "Default (no save)",
    name: "Neutral Amber",
    branding: null,
  },
  {
    label: "Very dark team",
    name: "Harbor Wolves",
    branding: {
      primaryColor: "#0B1F3A",
      secondaryColor: "#C4CED4",
      accentColor: "#F5B800",
      logoId: "wolf",
    },
  },
  {
    label: "Very light team",
    name: "Summit Eagles",
    branding: {
      primaryColor: "#F2F0E6",
      secondaryColor: "#1D6B44",
      accentColor: "#C8102E",
      logoId: "eagle",
    },
  },
] as const;

const OPPONENT = {
  name: "Delta Bulls",
  branding: {
    primaryColor: "#C8102E",
    secondaryColor: "#111111",
    accentColor: "#FFFFFF",
    logoId: "bull",
  },
};

export default function BroadcastUiShowcasePage() {
  return (
    <main className="min-h-screen bg-surface-deep px-4 py-8 text-zinc-100 sm:px-6">
      <SectionHeading
        as="h1"
        size="lg"
        eyebrow="Dev / visual QA"
        title="Broadcast UI primitives"
      />
      <p className="mt-3 max-w-2xl text-sm text-zinc-400">
        ArenaPanel, ScoreNumeral, TickerBar, TeamBadge and SectionHeading under
        three team themes. Toggle the OS reduced-motion setting to confirm the
        hero sheen, entrance and pulse animations stop.
      </p>

      <div className="mt-10 space-y-14">
        {THEMES.map((theme) => (
          <TeamThemeScope
            key={theme.label}
            branding={theme.branding}
            as="section"
            className="space-y-6"
          >
            <SectionHeading
              eyebrow={theme.label}
              title={theme.name}
              action={
                <button
                  type="button"
                  className={cn(
                    touchTargetClass,
                    focusRingClass,
                    "rounded-lg bg-team px-4 font-display text-base font-bold uppercase tracking-wide text-on-team",
                  )}
                >
                  Primary action
                </button>
              }
            />

            <ArenaPanel hero glow density="comfortable" className="enter-up">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-4">
                  <TeamBadge
                    branding={theme.branding}
                    name={theme.name}
                    size="xl"
                    decorative
                  />
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-team-ink">
                      Home
                    </p>
                    <p className="font-display text-3xl font-bold uppercase">
                      {theme.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <ScoreNumeral value={112} size="xl" tone="team" />
                  <span className="pb-3 font-display text-2xl text-zinc-500">
                    –
                  </span>
                  <ScoreNumeral value={104} size="xl" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-end">
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-zinc-400">
                      Away
                    </p>
                    <p className="font-display text-3xl font-bold uppercase">
                      {OPPONENT.name}
                    </p>
                  </div>
                  <TeamBadge
                    branding={OPPONENT.branding}
                    name={OPPONENT.name}
                    size="xl"
                    decorative
                  />
                </div>
              </div>
            </ArenaPanel>

            <ArenaPanel edge="top" density="compact">
              <TickerBar
                aria-label="Team summary"
                items={[
                  { label: "Date", value: "Nov 14" },
                  { label: "Record", value: "9-3", tone: "team" },
                  { label: "Conf rank", value: "2nd" },
                  { label: "Streak", value: "W4", tone: "win" },
                  { label: "Last", value: "L 98-101", tone: "loss" },
                  { label: "Live", value: "Q3 4:12", tone: "live" },
                  { label: "Alerts", value: 3, tone: "warning" },
                ]}
              />
            </ArenaPanel>

            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  { edge: "left", label: "Overall", value: 95, tone: "team" },
                  { edge: "left", label: "Wins", value: 52, tone: "win" },
                  { edge: "left", label: "Losses", value: 30, tone: "loss" },
                ] as const
              ).map((stat, index) => (
                <ArenaPanel
                  key={stat.label}
                  edge={stat.edge}
                  raised
                  className="enter-up hover-lift"
                  as="div"
                  style={{ "--i": index + 1 } as React.CSSProperties}
                >
                  <ScoreNumeral
                    value={stat.value}
                    label={stat.label}
                    size="lg"
                    tone={stat.tone}
                  />
                </ArenaPanel>
              ))}
            </div>

            <PlayerProfileHero
              playerId="dev_player"
              firstName="Leo"
              lastName="Drake"
              position="PG"
              age={29}
              overall={95}
              teamName={theme.name}
              teamAbbreviation="DEV"
              branding={theme.branding}
              availabilityStatus="healthy"
            />

            <ArenaPanel raised as="div">
              <RatingBars
                aria-label="Key ratings"
                items={[
                  { label: "Three point", rating: 94 },
                  { label: "Ball handling", rating: 86 },
                  { label: "Passing", rating: 77 },
                  { label: "Rebounding", rating: 64 },
                  { label: "Defense", rating: 52 },
                  { label: "Free throw", rating: null },
                ]}
              />
            </ArenaPanel>

            <div className="flex flex-wrap items-center gap-4">
              {(["sm", "md", "lg", "xl"] as const).map((size) => (
                <TeamBadge
                  key={size}
                  branding={theme.branding}
                  name={theme.name}
                  size={size}
                />
              ))}
              <TeamBadge branding={null} name="Missing Branding" size="lg" />
              <span className="team-pulse inline-flex h-11 items-center rounded-lg border border-team-ink px-3 font-display font-bold uppercase text-team-ink">
                Next game pulse
              </span>
            </div>
          </TeamThemeScope>
        ))}
      </div>
    </main>
  );
}
