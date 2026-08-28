import { selectTeamAction } from "@/application/actions";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamBrandingView } from "@/state/team-branding-view";

export type TeamPickEntry = {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  conferenceName: string;
  divisionName: string;
  branding: TeamBrandingView | null;
};

export function OwnerTeamPick(props: {
  saveId: string;
  teams: readonly TeamPickEntry[];
}) {
  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {props.teams.map((team) => (
          <li
            key={team.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {team.branding ? (
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700"
                  style={{ backgroundColor: team.branding.primaryColor }}
                >
                  <TeamLogoMark
                    branding={team.branding}
                    size="md"
                    title={`${team.city} ${team.name}`}
                  />
                </span>
              ) : (
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-700/40 bg-amber-950/50 font-mono text-xs font-semibold text-amber-400">
                  {team.abbreviation}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-medium text-zinc-100">
                  {team.city} {team.name}{" "}
                  <span className="font-mono text-xs text-zinc-500">
                    ({team.abbreviation})
                  </span>
                </p>
                <p className="text-xs text-zinc-500">
                  {team.conferenceName} · {team.divisionName}
                </p>
              </div>
            </div>
            <form action={selectTeamAction}>
              <input type="hidden" name="saveId" value={props.saveId} />
              <input type="hidden" name="teamId" value={team.id} />
              <button
                type="submit"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                Select
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
