import { renameLeagueAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/owner/game-setup/fields";
import { LEAGUE_NAME_MAX_LENGTH } from "@/systems/league-settings-edit";

export function RenameLeagueForm(props: {
  saveId: string;
  returnPath: string;
  leagueName: string;
  disabled: boolean;
}) {
  return (
    <form
      action={renameLeagueAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="saveId" value={props.saveId} />
      <input type="hidden" name="returnPath" value={props.returnPath} />
      <label className="block flex-1 space-y-1 text-sm text-zinc-300">
        <span>League name</span>
        <input
          type="text"
          name="leagueName"
          defaultValue={props.leagueName}
          maxLength={LEAGUE_NAME_MAX_LENGTH}
          required
          disabled={props.disabled}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={props.disabled}
        className={buttonClass({ variant: "primary" })}
      >
        Save name
      </button>
    </form>
  );
}
