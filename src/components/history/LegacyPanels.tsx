import { retireJerseyNumberAction } from "@/application/actions";
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
      <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {props.title}
      </h4>
      {props.entries.length === 0 ? (
        <p className="text-sm text-zinc-600">No games yet.</p>
      ) : (
        <ol className="space-y-0.5 text-sm">
          {props.entries.map((entry, index) => (
            <li
              key={`${entry.playerId}-${entry.context}-${index}`}
              className="flex items-baseline justify-between gap-2"
            >
              <span className="min-w-0 truncate text-zinc-300">
                <PlayerEntityLink
                  saveId={props.saveId}
                  playerId={entry.playerId}
                >
                  {entry.playerName}
                </PlayerEntityLink>
                <span className="ml-1 text-xs text-zinc-500">
                  {entry.context}
                </span>
              </span>
              <span className="tabular-nums font-medium text-zinc-100">
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
          <h3 className="mb-2 text-sm font-medium text-zinc-200">
            {STAT_LABELS[table.stat]}
          </h3>
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
          <p className="mb-3 text-sm text-zinc-300">
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

/** Hall of Fame, retired numbers and franchise legends. */
export function LegacyHonors(props: {
  saveId: string;
  returnPath: string;
  legacy: LegacyView;
}) {
  const { saveId, returnPath, legacy } = props;
  return (
    <>
      <Section title="Hall of Fame">
        {legacy.hallOfFame.length === 0 ? (
          <EmptyState message="No one has been inducted yet. Retired greats become eligible three seasons after their last." />
        ) : (
          <ul className="divide-y divide-zinc-800">
            {legacy.hallOfFame.map((inductee) => (
              <li key={inductee.playerId} className="py-2 text-sm">
                <PlayerEntityLink saveId={saveId} playerId={inductee.playerId}>
                  {inductee.playerName}
                </PlayerEntityLink>
                <span className="ml-2 text-zinc-500">
                  Class of {inductee.inductedSeasonYear}
                  {inductee.teamName ? ` · ${inductee.teamName}` : ""}
                </span>
                <p className="text-zinc-400">{inductee.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Retired numbers">
        {legacy.retiredNumbers.length === 0 ? (
          <p className="mb-3 text-sm text-zinc-500">
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
                <span className="text-xs text-zinc-300">
                  {entry.playerName}
                </span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mb-2 text-sm font-medium text-zinc-200">
          Franchise legends
        </h3>
        {legacy.legends.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Retired players with three or more seasons here appear here.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {legacy.legends.map((legend) => (
              <li
                key={legend.playerId}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <PlayerEntityLink saveId={saveId} playerId={legend.playerId}>
                    {legend.playerName}
                  </PlayerEntityLink>
                  <span className="ml-2 text-zinc-500">
                    No. {legend.number} · {legend.seasonsWithTeam} seasons here
                  </span>
                  <p className="text-zinc-400">{legend.summary}</p>
                  {legend.blockedReason ? (
                    <p className="text-xs text-zinc-500">
                      {legend.blockedReason}
                    </p>
                  ) : null}
                </div>
                <form action={retireJerseyNumberAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input
                    type="hidden"
                    name="playerId"
                    value={legend.playerId}
                  />
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
    </>
  );
}
