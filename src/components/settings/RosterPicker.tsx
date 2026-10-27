import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

/** Plain GET forms: the team and player live in the URL (`?team=&player=`). */
export function RosterPicker(props: {
  teams: Array<{ id: string; label: string }>;
  selectedTeamId: string | null;
  players: Array<{ id: string; label: string }>;
  selectedPlayerId: string | null;
}) {
  return (
    <div className="space-y-4">
      <form
        method="get"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label className="block space-y-1 text-sm text-soft sm:w-72">
          <span>Team</span>
          <Select
            name="team"
            defaultValue={props.selectedTeamId ?? ""}
            wrapperClassName="w-full"
          >
            <option value="" disabled>
              Choose a team
            </option>
            {props.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </Select>
        </label>
        <button type="submit" className={buttonClass({ variant: "secondary" })}>
          Load roster
        </button>
      </form>
      {props.selectedTeamId !== null ? (
        <form
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="team" value={props.selectedTeamId} />
          <label className="block space-y-1 text-sm text-soft sm:w-72">
            <span>Player</span>
            <Select
              name="player"
              defaultValue={props.selectedPlayerId ?? ""}
              wrapperClassName="w-full"
            >
              <option value="" disabled>
                Choose a player
              </option>
              {props.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.label}
                </option>
              ))}
            </Select>
          </label>
          <button
            type="submit"
            className={buttonClass({ variant: "secondary" })}
          >
            Edit player
          </button>
        </form>
      ) : null}
    </div>
  );
}
