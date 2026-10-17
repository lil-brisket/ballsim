"use client";

import { useState } from "react";
import {
  ActionCard,
  ArenaPanel,
  Button,
  CountUp,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  Gauge,
  Metric,
  MobileListCard,
  NumberStepper,
  Overlay,
  PageHeader,
  Panel,
  ProgressBar,
  RatingBars,
  ResultSparkline,
  ScoreBug,
  ScoreNumeral,
  Section,
  SectionHeading,
  Select,
  Sparkline,
  StatCard,
  StatusBadge,
  Tabs,
  TeamBadge,
  TeamLabel,
  TickerBar,
} from "@/components/ui";

export type ShowcaseBranding = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: string;
};

const TONES = [
  "success",
  "warning",
  "critical",
  "info",
  "active",
  "completed",
  "failed",
  "healthy",
  "available",
  "minor",
  "questionable",
  "limited",
  "recovery",
  "injured",
  "out",
  "suspended",
  "neutral",
] as const;

const RIVAL: ShowcaseBranding = {
  primaryColor: "#C8102E",
  secondaryColor: "#111111",
  accentColor: "#FFFFFF",
  logoId: "bull",
};

function Block(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <SectionHeading title={props.title} />
      {props.children}
    </div>
  );
}

/** Every shared UI primitive, rendered under the surrounding TeamThemeScope. */
export function TeamShowcase(props: {
  city: string;
  name: string;
  abbreviation: string;
  branding: ShowcaseBranding;
}) {
  const { branding, city, name, abbreviation } = props;
  const [tab, setTab] = useState("roster");
  const [stepper, setStepper] = useState(24);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const fullName = `${city} ${name}`;
  const suffix = abbreviation.toLowerCase();

  return (
    <div className="space-y-8">
      <Block title="ArenaPanel">
        <ArenaPanel hero glow texture watermark={branding}>
          <SectionHeading
            as="h3"
            size="lg"
            eyebrow="Hero panel"
            title={fullName}
            action={<Button variant="secondary">Action</Button>}
          />
          <div className="mt-4 flex items-end gap-4">
            <ScoreNumeral value={112} size="xl" tone="team" />
            <ScoreNumeral value={104} size="xl" />
          </div>
        </ArenaPanel>
        <ArenaPanel raised edge="left" density="compact">
          <ScoreNumeral value={52} label="Wins" size="lg" tone="win" />
        </ArenaPanel>
      </Block>

      <Block title="TickerBar">
        <TickerBar
          aria-label={`${fullName} summary`}
          items={[
            { label: "Record", value: "9-3", tone: "team" },
            { label: "Streak", value: "W4", tone: "win" },
            { label: "Last", value: "L 98-101", tone: "loss" },
            { label: "Live", value: "Q3 4:12", tone: "live" },
            { label: "Alerts", value: 3, tone: "warning" },
          ]}
        />
      </Block>

      <Block title="TeamBadge and TeamLabel">
        <div className="flex flex-wrap items-center gap-4">
          {(["sm", "md", "lg", "xl"] as const).map((size) => (
            <TeamBadge
              key={size}
              branding={branding}
              name={fullName}
              size={size}
            />
          ))}
        </div>
        <TeamLabel
          city={city}
          name={name}
          abbreviation={abbreviation}
          branding={branding}
          size="md"
        />
      </Block>

      <Block title="SectionHeading">
        <SectionHeading
          size="md"
          eyebrow="Medium"
          title="Medium heading"
          action={<Button variant="quiet">Action</Button>}
        />
        <SectionHeading
          size="lg"
          eyebrow="Large"
          title="Large heading"
          action={<Button variant="quiet">Action</Button>}
        />
      </Block>

      <Block title="PageHeader, Section, Panel">
        <PageHeader
          title="Page title"
          subtitle="Subtitle text"
          actions={<Button variant="primary">Primary</Button>}
        />
        <Section title="Section" action={<Button variant="quiet">More</Button>}>
          <Panel>Panel content</Panel>
        </Section>
      </Block>

      <Block title="StatCard, Metric, StatusBadge">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Points" value="112.4" mono />
          <StatCard label="Payroll" value="$142M" />
        </div>
        <Metric label="Net rating" value="+6.2" mono />
        <div className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <StatusBadge key={tone} label={tone} tone={tone} />
          ))}
        </div>
      </Block>

      <Block title="EmptyState and ErrorState">
        <EmptyState
          title="Nothing here"
          message="No games scheduled."
          action={<Button variant="secondary">Add</Button>}
        />
        <ErrorState message="Something went wrong." />
      </Block>

      <Block title="ProgressBar and RatingBars">
        <ProgressBar value={64} label="Progress" />
        <RatingBars
          aria-label={`${fullName} ratings`}
          items={[
            { label: "Three point", rating: 94 },
            { label: "Passing", rating: 77 },
            { label: "Defense", rating: 52 },
            { label: "Free throw", rating: null },
          ]}
        />
      </Block>

      <Block title="ActionCard and MobileListCard">
        <ActionCard
          href="/dev/broadcast-ui"
          title="Action card"
          description="Links somewhere."
          badge={<StatusBadge label="New" tone="active" />}
        />
        <MobileListCard
          title="List card"
          subtitle="Subtitle"
          meta="Meta"
          action={<Button variant="quiet">Open</Button>}
        />
      </Block>

      <Block title="DataTable">
        <DataTable headers={["Player", "PTS"]} caption="Scoring leaders">
          <tr>
            <td className="px-3 py-2">Leo Drake</td>
            <td className="px-3 py-2 text-right tabular-nums">28.4</td>
          </tr>
          <tr>
            <td className="px-3 py-2">Mia Voss</td>
            <td className="px-3 py-2 text-right tabular-nums">21.0</td>
          </tr>
        </DataTable>
      </Block>

      <Block title="Button">
        <div className="flex flex-wrap items-center gap-2">
          {(["primary", "secondary", "quiet", "danger"] as const).map(
            (variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["primary", "secondary", "quiet", "danger"] as const).map(
            (variant) => (
              <Button key={variant} variant={variant} size="lg">
                {variant} lg
              </Button>
            ),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled>
            Disabled primary
          </Button>
          <Button variant="secondary" disabled>
            Disabled secondary
          </Button>
        </div>
      </Block>

      <Block title="Select and NumberStepper">
        <Select aria-label={`Sort order ${suffix}`} defaultValue="ovr">
          <option value="ovr">Overall</option>
          <option value="age">Age</option>
        </Select>
        <NumberStepper
          aria-label={`Minutes ${suffix}`}
          value={stepper}
          onValueChange={setStepper}
          min={0}
          max={48}
          suffix="min"
        />
      </Block>

      <Block title="Tabs">
        <Tabs
          aria-label={`Link tabs ${suffix}`}
          activeKey="a"
          items={[
            { key: "a", label: "Overview", href: "/dev/broadcast-ui" },
            { key: "b", label: "Stats", href: "/dev/broadcast-ui#stats" },
          ]}
        />
        <Tabs
          aria-label={`Button tabs ${suffix}`}
          activeKey={tab}
          items={[
            {
              key: "roster",
              label: "Roster",
              onSelect: () => setTab("roster"),
            },
            {
              key: "depth",
              label: "Depth",
              onSelect: () => setTab("depth"),
              badge: 2,
            },
          ]}
        />
      </Block>

      <Block title="ScoreBug">
        <ScoreBug
          date="2026-11-14"
          teams={[
            { abbreviation, branding, score: 112 },
            { abbreviation: "DLT", branding: RIVAL, score: 104 },
          ]}
        />
        <ScoreBug
          date="2026-11-16"
          teams={[
            { abbreviation, branding, score: 98 },
            { abbreviation: "DLT", branding: RIVAL, score: 101 },
          ]}
        />
        <ScoreBug
          date="2026-11-18"
          overtime
          teams={[
            { abbreviation, branding, score: 121 },
            { abbreviation: "DLT", branding: RIVAL, score: 118 },
          ]}
        />
      </Block>

      <Block title="CountUp, Gauge, Sparkline">
        <p className="text-2xl font-bold tabular-nums">
          <CountUp value={1280} />
        </p>
        <Gauge label="Chemistry" value={72} />
        <Sparkline label="Points trend" values={[12, 18, 15, 24, 22, 30]} />
        <ResultSparkline results={["W", "W", "L", "W", "L", "W", "W"]} />
      </Block>

      <Block title="Drawer and Overlay">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer {suffix}
          </Button>
          <Button variant="secondary" onClick={() => setOverlayOpen(true)}>
            Open overlay {suffix}
          </Button>
        </div>
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title={`${fullName} drawer`}
          description="Drawer body"
        >
          <p className="text-sm text-zinc-300">Drawer content.</p>
        </Drawer>
        {overlayOpen ? (
          <Overlay onClick={() => setOverlayOpen(false)}>
            <div className="m-auto rounded-lg bg-zinc-900 p-6 text-sm">
              Overlay content. Click the backdrop to close.
            </div>
          </Overlay>
        ) : null}
      </Block>
    </div>
  );
}
