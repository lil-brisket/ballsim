import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

function formatAttributeLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1");
}

function FormDelta(props: {
  label: string;
  recent: number;
  season: number;
}) {
  const diff = props.recent - props.season;
  const tone =
    Math.abs(diff) < 0.3
      ? "text-zinc-400"
      : diff > 0
        ? "text-emerald-400"
        : "text-red-400";
  const arrow = Math.abs(diff) < 0.3 ? "→" : diff > 0 ? "↑" : "↓";
  return (
    <div className="rounded-lg border border-zinc-800 px-3 py-2">
      <p className="text-[10px] uppercase text-zinc-500">{props.label}</p>
      <p className="font-mono text-sm text-zinc-100">
        {props.recent.toFixed(1)}{" "}
        <span className={tone}>
          {arrow} {Math.abs(diff).toFixed(1)}
        </span>
      </p>
      <p className="text-[10px] text-zinc-600">
        vs {props.season.toFixed(1)} season
      </p>
    </div>
  );
}

export function PlayerOverview(props: {
  player: PlayerProfileView;
  actions?: React.ReactNode;
}) {
  const { player } = props;
  const avg = player.seasonAverages;

  return (
    <div className="space-y-6">
      <Section title="Season performance">
        {!avg ? (
          <EmptyState message="No games played this season." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Metric label="GP" value={String(avg.games)} />
            <Metric label="PPG" value={avg.ppg.toFixed(1)} />
            <Metric label="RPG" value={avg.rpg.toFixed(1)} />
            <Metric label="APG" value={avg.apg.toFixed(1)} />
            <Metric label="MPG" value={avg.mpg.toFixed(1)} />
            <Metric
              label="FG%"
              value={avg.fgPct !== null ? `${avg.fgPct}%` : "—"}
            />
            <Metric
              label="3P%"
              value={avg.threePct !== null ? `${avg.threePct}%` : "—"}
            />
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Strengths">
          {player.strengths.length === 0 ? (
            <EmptyState message="No standout strengths identified from attributes." />
          ) : (
            <ul className="space-y-2">
              {player.strengths.map((item) => (
                <li
                  key={item.attribute}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-100">{item.label}</span>
                  <span className="font-mono text-amber-400">{item.rating}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Weaknesses">
          {player.weaknesses.length === 0 ? (
            <EmptyState message="No clear weaknesses identified from attributes." />
          ) : (
            <ul className="space-y-2">
              {player.weaknesses.map((item) => (
                <li
                  key={item.attribute}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-100">{item.label}</span>
                  <span className="font-mono text-zinc-400">{item.rating}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Key attributes">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {player.keyAttributes.map((entry) => (
            <div
              key={entry.attribute}
              className="rounded-lg border border-zinc-800 px-3 py-2"
            >
              <p className="text-xs capitalize text-zinc-500">
                {formatAttributeLabel(entry.attribute)}
              </p>
              <p className="font-mono text-zinc-100">{entry.rating}</p>
            </div>
          ))}
        </div>
      </Section>

      {player.recentForm.last5Averages && player.recentForm.seasonAverages ? (
        <Section title="Recent form (last 5)">
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

      {props.actions}
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-[10px] uppercase text-zinc-500">{props.label}</p>
      <p className="mt-1 font-mono text-lg text-zinc-100">{props.value}</p>
    </div>
  );
}
