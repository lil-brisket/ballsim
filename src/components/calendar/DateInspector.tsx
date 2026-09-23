import Link from "next/link";
import type { CalendarDateInspectorView } from "@/systems/calendar";
import type { TeamId } from "@/domain/ids";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SimulationPreviewAction } from "@/components/calendar/SimulationPreviewAction";
import { cn, focusRingClass } from "@/components/ui/styles";

export function DateInspector(props: {
  saveId: string;
  returnPath: string;
  inspector: CalendarDateInspectorView;
  timeDisabled: boolean;
  /** Active owner franchise — kept for callers that need explicit scoping. */
  userTeamId?: TeamId;
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
    <aside className="flex h-full flex-col rounded-lg border border-zinc-800 bg-zinc-950/50">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-medium text-zinc-100">
            {inspector.longDateLabel}
          </h3>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-500">{inspector.date}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section className="space-y-1">
          <h4 className="text-xs uppercase tracking-wide text-zinc-500">
            Simulation status
          </h4>
          <p className="text-sm text-zinc-200">{inspector.phaseLabel}</p>
          <p className="text-xs text-zinc-400">{inspector.simulationStatus}</p>
        </section>

        <section className="space-y-2 rounded-md border border-sky-900/40 bg-sky-950/20 px-3 py-3">
          <h4 className="text-xs uppercase tracking-wide text-sky-400/90">
            Your team
          </h4>
          {inspector.teamGame ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-100">
                {inspector.teamGame.homeAwayLabel}
              </p>
              <p className="text-sm text-zinc-100">
                vs{" "}
                <TeamEntityLink
                  saveId={props.saveId}
                  teamId={inspector.teamGame.opponentTeamId}
                  className="text-zinc-100 hover:text-amber-400"
                >
                  {inspector.teamGame.opponentName}
                </TeamEntityLink>
              </p>
              <p className="text-xs text-zinc-400">
                {inspector.teamGame.seasonPhase}
                {inspector.teamGame.resultLabel
                  ? ` · ${inspector.teamGame.resultLabel}`
                  : ` · ${inspector.teamGame.status}`}
              </p>
              <Link
                href={`/dashboard/${props.saveId}/games/${inspector.teamGame.gameId}`}
                className={cn(
                  "inline-block text-xs text-amber-400 hover:text-amber-300",
                  focusRingClass,
                )}
              >
                View game
              </Link>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No team game</p>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-zinc-500">
            Special events
          </h4>
          {inspector.specialEvents.length === 0 ? (
            <p className="text-sm text-zinc-500">None</p>
          ) : (
            <ul className="space-y-2">
              {inspector.specialEvents.map((event) => (
                <li
                  key={event.id}
                  className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2"
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
                    <p className="mt-0.5 text-xs text-zinc-400">
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
            <h4 className="text-xs uppercase tracking-wide text-zinc-500">
              League context
            </h4>
            <p className="text-sm text-zinc-300">
              {inspector.leagueContextSnippet}
            </p>
          </section>
        ) : null}

        {inspector.simulationPreview ? (
          <section className="space-y-2 border-t border-zinc-800 pt-3">
            <h4 className="text-xs uppercase tracking-wide text-zinc-500">
              Simulation preview
            </h4>
            <ul className="space-y-1 text-sm text-zinc-300">
              {inspector.simulationPreview.summaryLines.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            <SimulationPreviewAction
              saveId={props.saveId}
              returnPath={props.returnPath}
              targetDate={inspector.date}
              disabled={props.timeDisabled}
              canSimulate={
                inspector.action === "simulate_to_date" &&
                inspector.simulationPreview.canSimulate
              }
            />
          </section>
        ) : (
          <p className="border-t border-zinc-800 pt-3 text-xs text-zinc-500">
            Select a future date to preview and confirm a simulation jump.
            Selecting a date alone does not advance time.
          </p>
        )}
      </div>
    </aside>
  );
}
