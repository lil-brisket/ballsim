import { AttributeRadar } from "@/components/basketball/player-card/AttributeRadar";
import { RecentPerformanceChart } from "@/components/basketball/player-card/RecentPerformanceChart";
import { StatTile } from "@/components/basketball/player-card/StatTile";
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
      ? "text-zinc-400"
      : diff > 0
        ? "text-emerald-400"
        : "text-red-400";
  const arrow = Math.abs(diff) < 0.3 ? "→" : diff > 0 ? "↑" : "↓";
  return (
    <div className={panelClass}>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
        {props.label}
      </p>
      <p className="font-mono text-sm text-zinc-100">
        {props.recent.toFixed(1)}{" "}
        <span className={tone}>
          {arrow} {Math.abs(diff).toFixed(1)}
        </span>
      </p>
      <p className="text-[10px] text-zinc-500">
        vs {props.season.toFixed(1)} season
      </p>
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
          <div
            role="group"
            aria-label="Season averages"
            className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9"
          >
            <StatTile label="GP" value={avg.games} />
            <StatTile label="MPG" value={avg.mpg.toFixed(1)} />
            <StatTile label="PPG" value={avg.ppg.toFixed(1)} />
            <StatTile label="RPG" value={avg.rpg.toFixed(1)} />
            <StatTile label="APG" value={avg.apg.toFixed(1)} />
            <StatTile label="SPG" value={avg.spg.toFixed(1)} />
            <StatTile label="BPG" value={avg.bpg.toFixed(1)} />
            <StatTile label="FG%" value={pctLabel(avg.fgPct)} />
            <StatTile label="3P%" value={pctLabel(avg.threePct)} />
          </div>
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
                  <span className="text-zinc-100">{item.label}</span>
                  <span className="font-mono text-team-ink">{item.rating}</span>
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
                  <span className="text-zinc-100">{item.label}</span>
                  <span className="font-mono text-zinc-400">{item.rating}</span>
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
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
                {formatAttributeLabel(entry.attribute)}
              </p>
              <p className="font-mono text-lg text-team-ink">{entry.rating}</p>
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
                <span className="text-zinc-100">{award.displayName}</span>
                <span className="ml-2 font-mono text-team-ink">
                  {award.periodLabel
                    ? award.periodLabel
                    : String(award.seasonYear)}
                </span>
                {award.teamName ? (
                  <span className="ml-2 text-zinc-500">{award.teamName}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {player.awardCareerTotals.length > 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
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
