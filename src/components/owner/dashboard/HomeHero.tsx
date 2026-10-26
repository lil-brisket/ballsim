import Link from "next/link";
import { PendingOwnerDecisionPanel } from "@/components/owner/dashboard/PendingOwnerDecisionPanel";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { buttonClass } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TeamBadge } from "@/components/ui/TeamBadge";
import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";
import type {
  ActionCenterItem,
  ActionCenterView,
} from "@/state/action-center-selectors";
import type { OwnerDashboardView } from "@/state/owner-dashboard";

export type HomeHeroDash = Pick<
  OwnerDashboardView,
  | "controlledTeam"
  | "flags"
  | "offseasonPriorities"
  | "pendingTradeOffer"
  | "seasonRecap"
  | "seasonStory"
  | "team"
>;

export type HomeHeroMode =
  | "other-team-offer"
  | "pending-offer"
  | "draft-clock"
  | "season-review"
  | "urgent-actions"
  | "next-game"
  | "offseason";

/**
 * Which single situation the hero speaks to, in priority order: an offer that
 * needs another franchise, an offer for this franchise, the draft clock, the
 * season review, urgent actions, the next game, then the offseason.
 */
export function resolveHomeHeroMode(
  dash: HomeHeroDash,
  actionCenter: Pick<ActionCenterView, "hasUrgentActions">,
): HomeHeroMode {
  const offer = dash.pendingTradeOffer;
  if (offer && offer.primaryTeamId !== dash.controlledTeam.id) {
    return "other-team-offer";
  }
  if (offer) return "pending-offer";
  if (dash.flags.userOnDraftClock) return "draft-clock";
  if (dash.flags.seasonReviewPending) return "season-review";
  if (actionCenter.hasUrgentActions) return "urgent-actions";
  if (dash.team.upcomingGames[0]) return "next-game";
  return "offseason";
}

const PRIMARY = cn(
  buttonClass({ variant: "primary", size: "lg" }),
  "w-full sm:w-auto",
);
const QUIET = cn(buttonClass({ variant: "quiet" }), "w-full sm:w-auto");

function Actions(props: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:shrink-0 md:justify-end">
      {props.children}
    </div>
  );
}

/** Message on the left, actions on the right from `md`; stacked on phones. */
function HeroRow(props: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
      {props.children}
    </div>
  );
}

function blockingItems(view: ActionCenterView): ActionCenterItem[] {
  return view.items.filter(
    (item) => item.severity === "critical" || item.severity === "warning",
  );
}

/**
 * Home hero: one situation, one primary action. See {@link resolveHomeHeroMode}
 * for the order; the pending trade offer renders its own panel inside it.
 */
export function HomeHero(props: {
  saveId: string;
  dash: HomeHeroDash;
  actionCenter: ActionCenterView;
  aiCanHandle?: boolean;
  letAiHandleAction?: (formData: FormData) => void | Promise<void>;
  switchTeamAction: (formData: FormData) => void | Promise<void>;
}) {
  const { saveId, dash, actionCenter } = props;
  const base = `/dashboard/${saveId}`;
  const mode = resolveHomeHeroMode(dash, actionCenter);
  const nextGame = dash.team.upcomingGames[0];
  const team = dash.controlledTeam;
  const offer = dash.pendingTradeOffer;

  let body: React.ReactNode;
  let labelledBy = "home-hero-title";

  switch (mode) {
    case "other-team-offer": {
      body = (
        <HeroRow>
          <SectionHeading
            id="home-hero-title"
            title={`${offer!.receivingTeamName} needs your attention before time can advance`}
          />
          <form action={props.switchTeamAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="teamId" value={offer!.primaryTeamId} />
            <button type="submit" className={PRIMARY}>
              Switch to {offer!.receivingTeamName}
            </button>
          </form>
        </HeroRow>
      );
      break;
    }
    case "pending-offer": {
      labelledBy = "pending-trade-title";
      body = (
        <PendingOwnerDecisionPanel
          saveId={saveId}
          returnPath={base}
          offer={offer!}
        />
      );
      break;
    }
    case "draft-clock": {
      body = (
        <HeroRow>
          <div className="space-y-2">
            <SectionHeading id="home-hero-title" title="You're on the clock" />
            <p className="text-sm text-soft">
              Make your selection on the Draft screen before advancing time.
            </p>
          </div>
          <Actions>
            <Link href={`${base}/draft`} className={PRIMARY}>
              Open Draft
            </Link>
          </Actions>
        </HeroRow>
      );
      break;
    }
    case "season-review": {
      body = (
        <HeroRow>
          <div className="space-y-2">
            <SectionHeading id="home-hero-title" title="Season review" />
            {dash.seasonRecap ? (
              <p className="text-sm text-soft">
                Record {dash.seasonRecap.record}
                <span className="mx-2 text-disabled" aria-hidden>
                  ·
                </span>
                Playoffs: {dash.seasonRecap.playoffResult}
              </p>
            ) : null}
            {dash.seasonStory ? (
              <p className="max-w-3xl text-sm text-muted">{dash.seasonStory}</p>
            ) : null}
          </div>
          <Actions>
            <Link href={`${base}/calendar`} className={PRIMARY}>
              Continue in Schedule
            </Link>
          </Actions>
        </HeroRow>
      );
      break;
    }
    case "urgent-actions": {
      const [first, ...rest] = blockingItems(actionCenter);
      const more = rest.slice(0, 2);
      const count = actionCenter.urgentCount;
      body = (
        <HeroRow>
          <div className="space-y-2">
            <SectionHeading
              id="home-hero-title"
              title={`${count} action${count === 1 ? " needs" : "s need"} attention before time can advance`}
            />
            {first ? (
              <div>
                <p className="text-lg font-semibold text-ink">{first.title}</p>
                <p className="max-w-3xl text-sm text-soft">
                  {first.description}
                </p>
              </div>
            ) : null}
          </div>
          <Actions>
            {first ? (
              <Link href={first.href} className={PRIMARY}>
                {first.hrefLabel}
              </Link>
            ) : null}
            {more.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  touchTargetTextClass,
                  "text-sm text-soft underline-offset-4 hover:text-ink hover:underline",
                  focusRingClass,
                )}
              >
                {item.title}
              </Link>
            ))}
            {props.aiCanHandle && props.letAiHandleAction ? (
              <form action={props.letAiHandleAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="returnPath" value={base} />
                <button type="submit" className={QUIET}>
                  Let AI handle
                </button>
              </form>
            ) : null}
          </Actions>
        </HeroRow>
      );
      break;
    }
    case "next-game": {
      const game = nextGame!;
      const teamName = `${team.city} ${team.name}`;
      body = (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8">
          <div className="space-y-2">
            <SectionHeading
              id="home-hero-title"
              eyebrow="Next game"
              title={`${game.home ? "vs" : "at"} ${game.opponentName}`}
            />
            <p className="text-sm text-soft">
              {formatGameDate(game.date, { weekday: true })}
              <span className="mx-2 text-disabled" aria-hidden>
                ·
              </span>
              {game.home ? "Home game" : "Road game"}
            </p>
          </div>
          <div aria-hidden className="flex items-center gap-3">
            <TeamBadge
              branding={team.branding}
              name={teamName}
              size="lg"
              decorative
            />
            <span className="font-display text-xl font-bold uppercase tracking-widest text-faint">
              {game.home ? "vs" : "@"}
            </span>
            <TeamBadge
              branding={game.opponentBranding}
              name={game.opponentName}
              size="lg"
              decorative
            />
          </div>
          <Actions>
            <Link href={`${base}/calendar?focus=next-game`} className={PRIMARY}>
              Sim to tip-off
            </Link>
            <Link href={`${base}/team-management/lineups`} className={QUIET}>
              Review rotation
            </Link>
          </Actions>
        </div>
      );
      break;
    }
    case "offseason": {
      const priorities = dash.offseasonPriorities.slice(0, 3);
      body = (
        <HeroRow>
          <div className="space-y-2">
            <SectionHeading id="home-hero-title" title="Offseason" />
            {priorities.length > 0 ? (
              <ul className="space-y-1 text-sm text-soft">
                {priorities.map((priority) => (
                  <li key={priority}>{priority}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <Actions>
            <Link href={`${base}/offseason`} className={PRIMARY}>
              Open Offseason Hub
            </Link>
          </Actions>
        </HeroRow>
      );
      break;
    }
  }

  return (
    <ArenaPanel
      as="section"
      hero
      texture
      watermark={team.branding}
      glow={mode === "next-game"}
      density="default"
      aria-labelledby={labelledBy}
    >
      {body}
    </ArenaPanel>
  );
}
