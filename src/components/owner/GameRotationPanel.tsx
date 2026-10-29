import type { GameRotationPanelView } from "@/state/selectors";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

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
          <SectionHeading as="h4" size="sm" tone="soft" title="Substitutions" />
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm text-faint">
            {props.rotation.substitutions.map((entry, index) => (
              <li key={`${entry.clockLabel}-${index}`}>
                <span className="font-mono text-muted">{entry.clockLabel}</span>{" "}
                <span className="text-faint/80">{entry.teamAbbreviation}</span>{" "}
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
      <SectionHeading as="h4" size="sm" tone="soft" title={props.title} />
      <ul className="mt-2 space-y-2 text-sm">
        {props.players.slice(0, 12).map((player) => (
          <li key={player.playerId} className="border-b border-line pb-2">
            <div className="flex justify-between gap-2 text-ink">
              <span>{player.name}</span>
              <span className="tabular-nums text-muted">
                {player.minutes}
                {player.targetMinutes != null
                  ? ` / ${player.targetMinutes}`
                  : ""}{" "}
                MIN
              </span>
            </div>
            {player.explanations.length > 0 ? (
              <ul className="mt-1 text-sm text-faint">
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
