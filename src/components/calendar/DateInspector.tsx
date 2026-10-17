import Link from "next/link";
import type { CalendarDateInspectorView } from "@/systems/calendar";
import type { TeamId } from "@/domain/ids";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TeamBadge } from "@/components/ui/TeamBadge";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { SimulationPreviewAction } from "@/components/calendar/SimulationPreviewAction";
import { cn, focusRingClass } from "@/components/ui/styles";

export function DateInspector(props: {
  saveId: string;
  returnPath: string;
  inspector: CalendarDateInspectorView;
  timeDisabled: boolean;
  /** Active owner franchise — kept for callers that need explicit scoping. */
  userTeamId?: TeamId;
  simulating?: boolean;
  onSimulate: (targetDate: string) => void;
  /** When false, preview copy stays but the Simulate control is omitted (sheet footer). */
  showSimulateAction?: boolean;
  /** Hide the date heading when a parent sheet already shows it. */
  hideTitle?: boolean;
  /** Controlled franchise identity for the matchup card. */
  userTeamName?: string;
  userBranding?: TeamBrandingView | null;
  /** Branding by team id, to resolve the opponent badge. */
  teamBranding?: Readonly<Record<string, TeamBrandingView>>;
}) {
  const { inspector } = props;
  const statusLabel =
    inspector.dateStatus === "today"
      ? "Today"
      : inspector.dateStatus === "past"
        ? "Past"
        : "Upcoming";
  const statusTone =
    inspector.dateStatus === "today"
      ? "warning"
      : inspector.dateStatus === "past"
        ? "info"
        : "info";

  return (
    <ArenaPanel
      as="aside"
      edge="top"
      density="compact"
      className="flex h-full flex-col !p-0"
    >
      {props.hideTitle ? null : (
        <div className="border-b border-surface-line px-4 py-3">
          <SectionHeading
            as="h3"
            title={inspector.longDateLabel}
            action={<StatusBadge label={statusLabel} tone={statusTone} />}
          />
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section className="space-y-1">
          <h4 className="text-sm font-medium text-zinc-300">
            Simulation status
          </h4>
          <p className="text-sm text-zinc-200">{inspector.phaseLabel}</p>
          <p className="text-sm text-zinc-400">{inspector.simulationStatus}</p>
        </section>

        <section
          className="space-y-3 rounded-xl border border-team-ink/30 bg-team/15 px-3 py-3"
          aria-label="Your team"
        >
          <h4 className="text-sm font-medium text-team-ink">Your team</h4>
          {inspector.teamGame ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <TeamBadge
                  branding={props.userBranding}
                  name={props.userTeamName ?? "Your team"}
                  size="lg"
                  decorative
                />
                <p
                  aria-hidden
                  className="font-display text-xl font-bold uppercase tracking-[0.3em] text-zinc-400"
                >
                  {inspector.teamGame.home ? "vs" : "@"}
                </p>
                <TeamBadge
                  branding={
                    props.teamBranding?.[inspector.teamGame.opponentTeamId]
                  }
                  name={inspector.teamGame.opponentName}
                  size="lg"
                  decorative
                />
              </div>
              <p className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-zinc-50">
                <span className="text-sm font-semibold text-team-ink">
                  {inspector.teamGame.homeAwayLabel}
                </span>{" "}
                vs{" "}
                <TeamEntityLink
                  saveId={props.saveId}
                  teamId={inspector.teamGame.opponentTeamId}
                  className="text-left text-zinc-50 hover:text-team-ink"
                >
                  {inspector.teamGame.opponentName}
                </TeamEntityLink>
              </p>
              {inspector.teamGame.resultLabel ? (
                <ScoreNumeral
                  value={inspector.teamGame.resultLabel}
                  size="md"
                  tone={
                    inspector.teamGame.resultLabel.startsWith("W")
                      ? "win"
                      : inspector.teamGame.resultLabel.startsWith("L")
                        ? "loss"
                        : "default"
                  }
                />
              ) : null}
              <p className="text-sm text-zinc-300">
                {inspector.teamGame.seasonPhase}
                {inspector.teamGame.resultLabel
                  ? ` · ${inspector.teamGame.resultLabel}`
                  : ` · ${inspector.teamGame.status}`}
              </p>
              {inspector.teamGame.status === "final" ? (
                <Link
                  href={`/dashboard/${props.saveId}/games/${inspector.teamGame.gameId}`}
                  className={cn(
                    "inline-flex min-h-11 items-center text-sm font-medium text-team-ink hover:underline",
                    focusRingClass,
                  )}
                >
                  View game
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-zinc-300">No team game</p>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-300">Special events</h4>
          {inspector.specialEvents.length === 0 ? (
            <p className="text-sm text-zinc-400">None</p>
          ) : (
            <ul className="space-y-2">
              {inspector.specialEvents.map((event) => (
                <li
                  key={event.id}
                  className="rounded-md border border-surface-line bg-surface-raised px-3 py-2"
                >
                  {event.href ? (
                    <Link
                      href={event.href}
                      className="block text-sm text-zinc-100"
                    >
                      {event.title}
                    </Link>
                  ) : (
                    <p className="text-sm text-zinc-100">{event.title}</p>
                  )}
                  {event.description ? (
                    <p className="mt-0.5 text-sm text-zinc-400">
                      {event.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {inspector.leagueContextSnippet ? (
          <section className="space-y-1">
            <h4 className="text-sm font-medium text-zinc-300">
              League context
            </h4>
            <p className="text-sm text-zinc-300">
              {inspector.leagueContextSnippet}
            </p>
          </section>
        ) : null}

        {inspector.simulationPreview ? (
          <section className="space-y-2 border-t border-surface-line pt-3">
            <h4 className="text-sm font-medium text-zinc-300">
              Simulation preview
            </h4>
            <ul className="space-y-1 text-sm text-zinc-300">
              {inspector.simulationPreview.summaryLines.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            {inspector.simulationPreview.blockReason ? (
              <p className="text-sm text-red-300">
                {inspector.simulationPreview.blockReason}
              </p>
            ) : null}
            {props.showSimulateAction === false ? null : (
              <SimulationPreviewAction
                saveId={props.saveId}
                returnPath={props.returnPath}
                targetDate={inspector.date}
                disabled={
                  props.timeDisabled || !inspector.simulationPreview.canSimulate
                }
                canSimulate={
                  inspector.action === "simulate_to_date" &&
                  inspector.simulationPreview.canSimulate
                }
                simulating={props.simulating}
                onSimulate={props.onSimulate}
              />
            )}
          </section>
        ) : (
          <p className="border-t border-surface-line pt-3 text-sm text-zinc-400">
            Select a future date to simulate through that day. Past dates show
            results for games already played.
          </p>
        )}
      </div>
    </ArenaPanel>
  );
}
