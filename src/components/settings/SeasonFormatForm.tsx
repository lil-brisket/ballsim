"use client";

import { useState, useTransition } from "react";
import { updateLeagueSettingsAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { SelectField } from "@/components/owner/game-setup/fields";
import {
  SUPPORTED_GAMES_PER_TEAM,
  SUPPORTED_PLAYOFF_TEAM_COUNTS,
  SUPPORTED_SERIES_LENGTHS,
} from "@/domain/game-settings";

type SeasonFormat = {
  gamesPerTeam: number;
  playoffTeams: number;
  seriesLength: number;
};

function seriesLabel(length: number): string {
  return length === 1 ? "Single game" : `Best of ${length}`;
}

export function SeasonFormatForm(props: {
  saveId: string;
  returnPath: string;
  initial: SeasonFormat;
  liveTeamCount: number;
  /** Why the format cannot change right now; null when it can. */
  lockReason: string | null;
  /** False for non-host members of an online league. */
  canEdit: boolean;
}) {
  const [format, setFormat] = useState<SeasonFormat>(props.initial);
  const [pending, startTransition] = useTransition();
  const locked = props.lockReason !== null || !props.canEdit;
  const changed =
    format.gamesPerTeam !== props.initial.gamesPerTeam ||
    format.playoffTeams !== props.initial.playoffTeams ||
    format.seriesLength !== props.initial.seriesLength;
  const playoffOptions = SUPPORTED_PLAYOFF_TEAM_COUNTS.filter(
    (count) =>
      count <= props.liveTeamCount || count === props.initial.playoffTeams,
  );

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        startTransition(() => {
          void updateLeagueSettingsAction(formData);
        });
      }}
    >
      <input type="hidden" name="saveId" value={props.saveId} />
      <input type="hidden" name="returnPath" value={props.returnPath} />
      <input
        type="hidden"
        name="changesJson"
        value={JSON.stringify({ seasonFormat: format })}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Games per team"
          value={format.gamesPerTeam}
          disabled={locked}
          options={SUPPORTED_GAMES_PER_TEAM.map((count) => ({
            value: count,
            label: `${count}`,
          }))}
          onChange={(gamesPerTeam) => setFormat({ ...format, gamesPerTeam })}
        />
        <SelectField
          label="Playoff teams"
          value={format.playoffTeams}
          disabled={locked}
          options={playoffOptions.map((count) => ({
            value: count,
            label: `${count}`,
          }))}
          onChange={(playoffTeams) => setFormat({ ...format, playoffTeams })}
        />
        <SelectField
          label="Series length"
          value={format.seriesLength}
          disabled={locked}
          options={SUPPORTED_SERIES_LENGTHS.map((length) => ({
            value: length,
            label: seriesLabel(length),
          }))}
          onChange={(seriesLength) => setFormat({ ...format, seriesLength })}
        />
      </div>
      {props.lockReason ? (
        <p className="text-sm text-muted">{props.lockReason}</p>
      ) : (
        <button
          type="submit"
          disabled={locked || pending || !changed}
          className={buttonClass({ variant: "primary" })}
        >
          {pending ? "Saving…" : "Save season format"}
        </button>
      )}
    </form>
  );
}
