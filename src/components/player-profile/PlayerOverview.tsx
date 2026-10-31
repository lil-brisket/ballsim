import { AttributeRadar } from "@/components/basketball/player-card/AttributeRadar";
import { RecentPerformanceChart } from "@/components/basketball/player-card/RecentPerformanceChart";
import { SeasonAverageStrip } from "@/components/basketball/player-card/SeasonAverageStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import type { PlayerAttributes } from "@/domain/entities/player";
import { formatAttributeLabel } from "@/presentation/player-rating-categories";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

const panelClass =
  "rounded-lg border border-surface-line bg-surface-deep/80 px-3 py-2";

function FormDelta(props: { label: string; recent: number; season: number }) {
  const diff = props.recent - props.season;
  const tone =
    Math.abs(diff) < 0.3
      ? "text-muted"
      : diff > 0
        ? "text-success"
        : "text-danger";
  const arrow = Math.abs(diff) < 0.3 ? "→" : diff > 0 ? "↑" : "↓";
  return (
    <div className={panelClass}>
      <p className="text-sm text-muted">{props.label}</p>
      <p className="tabular-nums text-sm text-ink">
        {props.recent.toFixed(1)}{" "}
        <span className={tone}>
          {arrow} {Math.abs(diff).toFixed(1)}
        </span>
      </p>
      <p className="text-sm text-faint">vs {props.season.toFixed(1)} season</p>
    </div>
  );
}

function pctLabel(value: number | null): string {
  return value !== null ? `${value}%` : "—";
}

export function PlayerOverview(props: {
  player: PlayerProfileView;
  actions?: React.ReactNode;
}) {
  const { player } = props;
  const avg = player.seasonAverages;

  return (
    <div className="space-y-6">
      <Section title="Season averages" density="compact">
        {!avg ? (
          <EmptyState message="No games played this season." />
        ) : (
          <SeasonAverageStrip
            values={{
              games: avg.games,
              mpg: avg.mpg.toFixed(1),
              ppg: avg.ppg.toFixed(1),
              rpg: avg.rpg.toFixed(1),
              apg: avg.apg.toFixed(1),
              spg: avg.spg.toFixed(1),
              bpg: avg.bpg.toFixed(1),
              extras: [
                { label: "FG%", value: pctLabel(avg.fgPct) },
                { label: "3P%", value: pctLabel(avg.threePct) },
              ],
            }}
          />
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Attribute profile" density="compact">
          <AttributeRadar
            attributes={player.attributes as PlayerAttributes}
            size="sm"
          />
        </Section>
        <Section title="Recent performance" density="compact">
          <RecentPerformanceChart games={player.stats.currentSeasonGames} />
        </Section>
      </div>

      {player.recentForm.last5Averages && player.recentForm.seasonAverages ? (
        <Section title="Recent form (last 5)" density="compact">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <FormDelta
              label="PPG"
              recent={player.recentForm.last5Averages.ppg}
              season={player.recentForm.seasonAverages.ppg}
            />
            <FormDelta
              label="RPG"
              recent={player.recentForm.last5Averages.rpg}
              season={player.recentForm.seasonAverages.rpg}
            />
            <FormDelta
              label="APG"
              recent={player.recentForm.last5Averages.apg}
              season={player.recentForm.seasonAverages.apg}
            />
            <FormDelta
              label="MPG"
              recent={player.recentForm.last5Averages.mpg}
              season={player.recentForm.seasonAverages.mpg}
            />
          </div>
        </Section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Strengths" density="compact">
          {player.strengths.length === 0 ? (
            <EmptyState message="No standout strengths identified from attributes." />
          ) : (
            <ul className="space-y-2">
              {player.strengths.map((item) => (
                <li
                  key={item.attribute}
                  className={`${panelClass} flex items-center justify-between text-sm`}
                >
                  <span className="text-ink">{item.label}</span>
                  <span className="tabular-nums text-team-ink">
                    {item.rating}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Weaknesses" density="compact">
          {player.weaknesses.length === 0 ? (
            <EmptyState message="No clear weaknesses identified from attributes." />
          ) : (
            <ul className="space-y-2">
              {player.weaknesses.map((item) => (
                <li
                  key={item.attribute}
                  className={`${panelClass} flex items-center justify-between text-sm`}
                >
                  <span className="text-ink">{item.label}</span>
                  <span className="tabular-nums text-muted">{item.rating}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Key attributes" density="compact">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {player.keyAttributes.map((entry) => (
            <div key={entry.attribute} className={panelClass}>
              <p className="text-sm text-muted">
                {formatAttributeLabel(entry.attribute)}
              </p>
              <p className="tabular-nums text-lg text-team-ink">
                {entry.rating}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {player.awards.length > 0 ? (
        <Section title="Awards" density="compact">
          <ul className="space-y-1.5 text-sm">
            {player.awards.slice(0, 8).map((award) => (
              <li
                key={`${award.awardId}-${award.seasonYear}-${award.period ?? "y"}`}
                className={panelClass}
              >
                <span className="text-ink">{award.displayName}</span>
                <span className="ml-2 tabular-nums text-team-ink">
                  {award.periodLabel
                    ? award.periodLabel
                    : String(award.seasonYear)}
                </span>
                {award.teamName ? (
                  <span className="ml-2 text-faint">{award.teamName}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {player.awardCareerTotals.length > 0 ? (
            <p className="mt-3 text-sm text-faint">
              {player.awardCareerTotals
                .map((t) => `${t.count}× ${t.shortLabel}`)
                .join(" · ")}
            </p>
          ) : null}
        </Section>
      ) : null}

      {props.actions}
    </div>
  );
}
