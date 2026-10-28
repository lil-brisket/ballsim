"use client";

import {
  MomentOverlay,
  type MomentStep,
} from "@/components/moments/MomentOverlay";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { ChampionMomentView } from "@/state/champion-moment-selectors";

function TrophyGlyph() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-12 w-12 text-team-ink"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      <path d="M12 14v4M8 20h8M9 18h6" />
    </svg>
  );
}

function resultLine(view: ChampionMomentView): string {
  return view.finalsOpponentName
    ? `Beat ${view.finalsOpponentName} ${view.finalsWins} in the Finals`
    : `Won the Finals ${view.finalsWins}`;
}

function title(view: ChampionMomentView): string {
  return view.userTeamIsChampion
    ? `Your ${view.championName} are champions`
    : `${view.championName} win the title`;
}

function FinalsBody(props: { view: ChampionMomentView }) {
  const { view } = props;
  return (
    <div className="flex items-center gap-4">
      {view.branding ? (
        <TeamLogoMark branding={view.branding} size="lg" decorative />
      ) : null}
      <TrophyGlyph />
      <p className="text-lg">{resultLine(view)}</p>
    </div>
  );
}

export function buildChampionSteps(view: ChampionMomentView): MomentStep[] {
  return [
    {
      id: "champion",
      eyebrow: `${view.seasonYear} Finals`,
      title: title(view),
      body: <FinalsBody view={view} />,
      sting: view.userTeamIsChampion,
    },
  ];
}

/** Full-screen championship beat; league-wide, so every owner sees it. */
export function ChampionMoment(props: {
  view: ChampionMomentView;
  open: boolean;
  onClose: () => void;
}) {
  const { view } = props;
  return (
    <MomentOverlay
      open={props.open}
      onClose={props.onClose}
      label="Championship"
      steps={buildChampionSteps(view)}
      summary={{
        id: "summary",
        eyebrow: `${view.seasonYear} Finals`,
        title: title(view),
        body: <FinalsBody view={view} />,
      }}
    />
  );
}
