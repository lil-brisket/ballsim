import Link from "next/link";
import { getCurrentUser } from "@/application/auth/session";
import { joinLeagueAction } from "@/application/actions/online-league";
import { previewLeagueInvite } from "@/application/game-service/online-league";
import { onlineLeagueContext } from "@/application/online/context";
import { ErrorState } from "@/components/ui/EmptyState";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

const buttonClass = cn(
  touchTargetClass,
  "rounded-lg border-2 border-team-ink bg-team px-5 font-display text-lg font-extrabold uppercase tracking-wide text-on-team hover:brightness-110",
  focusRingClass,
);

export default async function JoinLeaguePage({
  params,
  searchParams,
}: PageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const { error } = await searchParams;
  const user = await getCurrentUser();
  const result = await previewLeagueInvite(await onlineLeagueContext(), token);
  const next = encodeURIComponent(`/join/${encodeURIComponent(token)}`);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="font-display text-3xl font-bold uppercase text-zinc-50">
        Join a league
      </h1>
      {error ? <ErrorState message={error} /> : null}

      {!result.ok ? (
        <>
          <ErrorState message={result.error} />
          <Link href="/home" className="text-sm text-amber-400 underline">
            Back to home
          </Link>
        </>
      ) : (
        <>
          <div className="space-y-1 text-zinc-200">
            <p className="text-xl font-semibold">{result.preview.leagueName}</p>
            <p className="text-sm text-zinc-400">
              Hosted by {result.preview.hostName} · {result.preview.playerCount}{" "}
              {result.preview.playerCount === 1 ? "player" : "players"}
            </p>
          </div>

          {!user ? (
            <div className="flex flex-wrap items-center gap-4">
              <Link href={`/login?next=${next}`} className={buttonClass}>
                Sign in to join
              </Link>
              <Link
                href={`/signup?next=${next}`}
                className="text-sm text-amber-400 underline"
              >
                Create an account
              </Link>
            </div>
          ) : result.preview.alreadyMember ? (
            <Link
              href={`/dashboard/${result.preview.saveId}`}
              className={buttonClass}
            >
              Go to league dashboard
            </Link>
          ) : result.preview.openTeams.length === 0 ? (
            <ErrorState message="This league has no open franchises right now." />
          ) : (
            <form action={joinLeagueAction} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm text-zinc-300">
                  Choose your franchise
                </legend>
                {result.preview.openTeams.map((team, index) => (
                  <label
                    key={team.id}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-surface-line px-3 text-sm text-zinc-100"
                  >
                    <input
                      type="radio"
                      name="teamId"
                      value={team.id}
                      defaultChecked={index === 0}
                      required
                    />
                    {team.city} {team.name}
                  </label>
                ))}
              </fieldset>
              <button type="submit" className={buttonClass}>
                Join league
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
