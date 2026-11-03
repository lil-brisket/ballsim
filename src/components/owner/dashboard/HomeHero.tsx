import Link from "next/link";
import { simHref } from "@/components/game/shell/shell-links";
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
import {
  formatGameDate,
  formatRelativeGameDay,
} from "@/presentation/game-date";
import type {
  ActionCenterItem,
  ActionCenterView,
} from "@/state/action-center-selectors";
import type { OwnerDashboardView } from "@/state/owner-dashboard";

export type HomeHeroDash = Pick<
  OwnerDashboardView,
  | "controlledTeam"
  | "currentDate"
  | "daysUntilTradeDeadline"
  | "flags"
  | "home"
  | "offseasonStage"
  | "seasonPhase"
  | "tradesOpen"
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

/** One side of the next-game matchup: badge, record and team rating. */
function MatchupSide(props: {
  branding: React.ComponentProps<typeof TeamBadge>["branding"];
  name: string;
  abbreviation: string;
  wins: number | null;
  losses: number | null;
  strength: number | null;
}) {
  const hasRecord = props.wins !== null && props.losses !== null;
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center gap-1 text-center">
      <TeamBadge
        branding={props.branding}
        name={props.name}
        size="lg"
        decorative
      />
      <span className="font-display text-lg font-bold uppercase tracking-wide text-ink">
        {props.abbreviation}
      </span>
      {hasRecord ? (
        <span className="text-sm tabular-nums text-soft">
          {props.wins}-{props.losses}
        </span>
      ) : null}
      {props.strength !== null ? (
        <span className="text-sm tabular-nums text-muted">
          Avg OVR {props.strength}
        </span>
      ) : null}
    </div>
  );
}

/** Days inside which the trade deadline earns a line in the hero. */
const DEADLINE_NOTICE_DAYS = 7;

function tradeDeadlineNote(dash: HomeHeroDash): string | null {
  const days = dash.daysUntilTradeDeadline;
  if (!dash.tradesOpen || days == null || days > DEADLINE_NOTICE_DAYS) {
    return null;
  }
  if (days <= 0) return "Trade deadline is today";
  return `Trade deadline in ${days} day${days === 1 ? "" : "s"}`;
}

type OffseasonFocus = { label: string; href: string; cta: string };

/** What the offseason hero points at for each stage; hub when none fits. */
function offseasonFocus(dash: HomeHeroDash, base: string): OffseasonFocus {
  switch (dash.offseasonStage) {
    case "draft_preparation":
    case "draft":
      return { label: "Draft", href: `${base}/draft`, cta: "Open Draft" };
    case "free_agency":
      return {
        label: "Free agency",
        href: `${base}/free-agency`,
        cta: "Open Free Agency",
      };
    case "contract_expiration":
    case "roster_decisions":
      return {
        label: "Roster decisions",
        href: `${base}/team/contracts`,
        cta: "Review Contracts",
      };
    case "staff_development":
      return {
        label: "Staff and development",
        href: `${base}/staff-coaching/staff`,
        cta: "Open Staff",
      };
    default:
      return {
        label: "Offseason",
        href: `${base}/offseason`,
        cta: "Open Offseason Hub",
      };
  }
}

function nextGameEyebrow(dash: HomeHeroDash): string {
  if (dash.seasonPhase === "preseason") return "Next preseason game";
  if (dash.seasonPhase === "playoffs") return "Next playoff game";
  return "Next game";
}

function seriesScoreLabel(
  series: NonNullable<HomeHeroDash["home"]["playoffSeries"]>,
): string {
  const { teamWins, opponentWins, opponentAbbreviation } = series;
  if (teamWins === opponentWins) {
    return `Series tied ${teamWins}-${opponentWins}`;
  }
  return teamWins > opponentWins
    ? `Leads ${opponentAbbreviation} ${teamWins}-${opponentWins}`
    : `Trails ${opponentAbbreviation} ${opponentWins}-${teamWins}`;
}

/** Critical and warning items, those that refuse time advance first. */
function urgentItems(view: ActionCenterView): ActionCenterItem[] {
  return view.items
    .filter(
      (item) => item.severity === "critical" || item.severity === "warning",
    )
    .sort((a, b) => Number(b.blocksAdvance) - Number(a.blocksAdvance));
}

function urgentTitle(view: ActionCenterView): string {
  const { blockingCount, urgentCount } = view;
  if (blockingCount > 0) {
    return `${blockingCount} action${blockingCount === 1 ? "" : "s"} must be resolved before time can advance`;
  }
  return `${urgentCount} action${urgentCount === 1 ? " needs" : "s need"} attention`;
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
      const [first, ...rest] = urgentItems(actionCenter);
      const more = rest.slice(0, 2);
      body = (
        <HeroRow>
          <div className="space-y-2">
            <SectionHeading
              id="home-hero-title"
              title={urgentTitle(actionCenter)}
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
      const series = dash.home.playoffSeries;
      const deadlineNote = tradeDeadlineNote(dash);
      const teamName = `${team.city} ${team.name}`;
      body = (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8">
          <div className="space-y-2">
            <SectionHeading
              id="home-hero-title"
              eyebrow={nextGameEyebrow(dash)}
              title={`${game.home ? "vs" : "at"} ${game.opponentName}`}
            />
            <p className="text-sm text-soft">
              {formatRelativeGameDay(game.date, dash.currentDate)}
              <span className="mx-2 text-disabled" aria-hidden>
                ·
              </span>
              {formatGameDate(game.date, { weekday: true })}
              <span className="mx-2 text-disabled" aria-hidden>
                ·
              </span>
              {game.home ? "Home game" : "Road game"}
            </p>
            {deadlineNote ? (
              <p className="text-sm font-medium text-warning">{deadlineNote}</p>
            ) : null}
            {series ? (
              <p className="text-sm font-medium text-ink">
                {series.roundLabel}
                <span className="mx-2 text-disabled" aria-hidden>
                  ·
                </span>
                {seriesScoreLabel(series)}
              </p>
            ) : null}
          </div>
          <div
            role="group"
            aria-label="Matchup"
            className="flex items-center gap-4"
          >
            <MatchupSide
              branding={team.branding}
              name={teamName}
              abbreviation={team.abbreviation}
              wins={dash.team.wins}
              losses={dash.team.losses}
              strength={dash.team.strength}
            />
            <span
              aria-hidden
              className="font-display text-xl font-bold uppercase tracking-widest text-faint"
            >
              {game.home ? "vs" : "@"}
            </span>
            <MatchupSide
              branding={game.opponentBranding}
              name={game.opponentName}
              abbreviation={game.opponentAbbreviation}
              wins={dash.team.nextOpponent?.wins ?? null}
              losses={dash.team.nextOpponent?.losses ?? null}
              strength={dash.team.nextOpponent?.strength ?? null}
            />
          </div>
          <Actions>
            <Link href={simHref(saveId)} className={PRIMARY}>
              Sim to tip-off
            </Link>
            <Link href={`${base}/games/${game.gameId}`} className={QUIET}>
              Game preview
            </Link>
            <Link href={`${base}/team-management/lineups`} className={QUIET}>
              Review rotation
            </Link>
            {deadlineNote ? (
              <Link href={`${base}/trades`} className={QUIET}>
                Open trades
              </Link>
            ) : null}
            {dash.seasonPhase === "preseason" ? (
              <Link href={`${base}/development`} className={QUIET}>
                Training and development
              </Link>
            ) : null}
          </Actions>
        </div>
      );
      break;
    }
    case "offseason": {
      const priorities = dash.offseasonPriorities.slice(0, 3);
      const focus = offseasonFocus(dash, base);
      body = (
        <HeroRow>
          <div className="space-y-2">
            <SectionHeading
              id="home-hero-title"
              eyebrow={focus.label === "Offseason" ? undefined : "Offseason"}
              title={focus.label}
            />
            {priorities.length > 0 ? (
              <ul className="space-y-1 text-sm text-soft">
                {priorities.map((priority) => (
                  <li key={priority}>{priority}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <Actions>
            <Link href={focus.href} className={PRIMARY}>
              {focus.cta}
            </Link>
            {focus.href !== `${base}/offseason` ? (
              <Link href={`${base}/offseason`} className={QUIET}>
                Offseason Hub
              </Link>
            ) : null}
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
