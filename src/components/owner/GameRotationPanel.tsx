import type { GameRotationPanelView } from "@/state/selectors";
import { Section } from "@/components/owner/Section";

export function GameRotationPanel(props: {
  rotation: GameRotationPanelView;
  homeAbbreviation: string;
  awayAbbreviation: string;
}) {
  return (
    <Section title="Rotation">
      <div className="grid gap-6 lg:grid-cols-2">
        <MinuteCompare
          title={props.homeAbbreviation}
          players={props.rotation.homePlayers}
        />
        <MinuteCompare
          title={props.awayAbbreviation}
          players={props.rotation.awayPlayers}
        />
      </div>
      {props.rotation.substitutions.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-zinc-300">Substitutions</h4>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs text-zinc-500">
            {props.rotation.substitutions.map((entry, index) => (
              <li key={`${entry.clockLabel}-${index}`}>
                <span className="font-mono text-zinc-400">
                  {entry.clockLabel}
                </span>{" "}
                <span className="text-amber-500/80">
                  {entry.teamAbbreviation}
                </span>{" "}
                {entry.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

function MinuteCompare(props: {
  title: string;
  players: GameRotationPanelView["homePlayers"];
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-zinc-300">{props.title}</h4>
      <ul className="mt-2 space-y-2 text-sm">
        {props.players.slice(0, 12).map((player) => (
          <li key={player.playerId} className="border-b border-zinc-800 pb-2">
            <div className="flex justify-between gap-2 text-zinc-200">
              <span>{player.name}</span>
              <span className="font-mono text-zinc-400">
                {player.minutes}
                {player.targetMinutes != null
                  ? ` / ${player.targetMinutes}`
                  : ""}{" "}
                MIN
              </span>
            </div>
            {player.explanations.length > 0 ? (
              <ul className="mt-1 text-xs text-zinc-500">
                {player.explanations.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
