import Link from "next/link";
import { notFound } from "next/navigation";
import {
  switchActiveOwnerTeamAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { PageHeader } from "@/components/owner/PageHeader";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";

type MyTeamsPageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function MyTeamsPage({ params }: MyTeamsPageProps) {
  const { saveId } = await params;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const ownedTeams = view.dashboard.ownedTeams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Teams"
        subtitle="Portfolio overview of every franchise you control."
      />

      <ul className="space-y-3">
        {ownedTeams.map((team) => (
          <li
            key={team.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700"
                style={{ backgroundColor: team.branding.primaryColor }}
              >
                <TeamLogoMark
                  branding={team.branding}
                  size="md"
                  title={`${team.city} ${team.name}`}
                />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-zinc-100">
                  {team.city} {team.name}
                  {team.isActive ? (
                    <span className="ml-2 text-xs font-normal text-amber-400">
                      ● Active
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-zinc-400">
                  {team.wins}–{team.losses}
                  {team.blockingDecisionCount > 0
                    ? ` · ⚠ ${team.blockingDecisionCount} decision${team.blockingDecisionCount === 1 ? "" : "s"}`
                    : " · ✓ No urgent decisions"}
                  {team.unreadNotificationCount > 0
                    ? ` · ${team.unreadNotificationCount} unread`
                    : ""}
                </p>
                <p className="text-xs capitalize text-zinc-500">
                  {team.ownerPhilosophy.replaceAll("_", " ")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!team.isActive ? (
                <form action={switchActiveOwnerTeamAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input type="hidden" name="teamId" value={team.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    Make Active
                  </button>
                </form>
              ) : (
                <Link
                  href={`/dashboard/${saveId}`}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  Open Dashboard
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
