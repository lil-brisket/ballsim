import { retireJerseyNumberAction } from "@/application/actions";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import type {
  LegacyView,
  RecordBookView,
  RecordEntry,
  RecordTable,
} from "@/state/legacy-selectors";

const STAT_LABELS: Record<RecordTable["stat"], string> = {
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
};

function EntryList(props: {
  saveId: string;
  title: string;
  entries: RecordEntry[];
}) {
  return (
    <div className="min-w-0">
      <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
        {props.title}
      </h4>
      {props.entries.length === 0 ? (
        <p className="text-sm text-disabled">No games yet.</p>
      ) : (
        <ol className="space-y-0.5 text-sm">
          {props.entries.map((entry, index) => (
            <li
              key={`${entry.playerId}-${entry.context}-${index}`}
              className="flex items-baseline justify-between gap-2"
            >
              <span className="min-w-0 truncate text-soft">
                <PlayerEntityLink
                  saveId={props.saveId}
                  playerId={entry.playerId}
                >
                  {entry.playerName}
                </PlayerEntityLink>
                <span className="ml-1 text-xs text-faint">{entry.context}</span>
              </span>
              <span className="tabular-nums font-medium text-ink">
                {entry.value}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Tables(props: { saveId: string; tables: RecordTable[] }) {
  return (
    <div className="space-y-5">
      {props.tables.map((table) => (
        <div key={table.stat}>
          <SectionHeading
            as="h3"
            size="sm"
            className="mb-2"
            title={STAT_LABELS[table.stat]}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <EntryList
              saveId={props.saveId}
              title="Single game"
              entries={table.single}
            />
            <EntryList
              saveId={props.saveId}
              title="Season (per game)"
              entries={table.season}
            />
            <EntryList
              saveId={props.saveId}
              title="Career"
              entries={table.career}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** League and franchise record book. */
export function RecordBook(props: { saveId: string; records: RecordBookView }) {
  const { saveId, records } = props;
  return (
    <>
      <Section title="Franchise records">
        {records.bestSeason ? (
          <p className="mb-3 text-sm text-soft">
            Best season: {records.bestSeason.wins}–{records.bestSeason.losses} (
            {records.bestSeason.seasonYear}) · {records.titles} title
            {records.titles === 1 ? "" : "s"}
          </p>
        ) : null}
        <Tables saveId={saveId} tables={records.franchise} />
      </Section>
      <Section title="League records">
        <Tables saveId={saveId} tables={records.league} />
      </Section>
    </>
  );
}

/** Hall of Fame inductees. */
export function HallOfFame(props: { saveId: string; legacy: LegacyView }) {
  const { saveId, legacy } = props;
  return (
    <Section title="Hall of Fame">
      {legacy.hallOfFame.length === 0 ? (
        <EmptyState message="No one has been inducted yet. Retired greats become eligible three seasons after their last." />
      ) : (
        <ul className="divide-y divide-line">
          {legacy.hallOfFame.map((inductee) => (
            <li key={inductee.playerId} className="py-2 text-sm">
              <PlayerEntityLink saveId={saveId} playerId={inductee.playerId}>
                {inductee.playerName}
              </PlayerEntityLink>
              <span className="ml-2 text-faint">
                Class of {inductee.inductedSeasonYear}
                {inductee.teamName ? ` · ${inductee.teamName}` : ""}
              </span>
              <p className="text-muted">{inductee.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Retired numbers and franchise legends who can join them. */
export function RetiredJerseysPanel(props: {
  saveId: string;
  returnPath: string;
  jerseys: Pick<LegacyView, "retiredNumbers" | "legends">;
}) {
  const { saveId, returnPath, jerseys: legacy } = props;
  return (
    <Section title="Retired numbers">
      {legacy.retiredNumbers.length === 0 ? (
        <p className="mb-3 text-sm text-faint">
          Your franchise has not retired a number yet.
        </p>
      ) : (
        <ul className="mb-4 flex flex-wrap gap-3">
          {legacy.retiredNumbers.map((entry) => (
            <li
              key={entry.number}
              className="flex min-w-24 flex-col items-center rounded-md border border-team-ink/40 bg-team/10 px-3 py-2"
            >
              <span className="font-mono text-2xl font-semibold text-team-ink">
                {entry.number}
              </span>
              <span className="text-xs text-soft">{entry.playerName}</span>
            </li>
          ))}
        </ul>
      )}
      <SectionHeading
        as="h3"
        size="sm"
        className="mb-2"
        title="Franchise legends"
      />
      {legacy.legends.length === 0 ? (
        <p className="text-sm text-faint">
          Retired players with three or more seasons here appear here.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {legacy.legends.map((legend) => (
            <li
              key={legend.playerId}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <div className="min-w-0">
                <PlayerEntityLink saveId={saveId} playerId={legend.playerId}>
                  {legend.playerName}
                </PlayerEntityLink>
                <span className="ml-2 text-faint">
                  No. {legend.number} · {legend.seasonsWithTeam} seasons here
                </span>
                <p className="text-muted">{legend.summary}</p>
                {legend.blockedReason ? (
                  <p className="text-xs text-faint">{legend.blockedReason}</p>
                ) : null}
              </div>
              <form action={retireJerseyNumberAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="playerId" value={legend.playerId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={legend.blockedReason !== null}
                >
                  Retire No. {legend.number}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
