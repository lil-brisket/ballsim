import Link from "next/link";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { cn, panelClass } from "@/components/ui/styles";
import type { TeamHubView } from "@/state/team-hub-selectors";

export function TeamRotationPreview(props: {
  saveId: string;
  hub: TeamHubView;
}) {
  const { saveId, hub } = props;
  const rotationHref = `/dashboard/${saveId}/team-management/rotations`;

  return (
    <Section
      title="Rotation"
      action={
        <Link href={rotationHref} className="text-sm text-amber-400">
          Manage Rotation
        </Link>
      }
    >
      <div className={cn(panelClass, "divide-y divide-zinc-800")}>
        <div className="px-4 py-2">
          <p className="font-mono text-[0.65rem] uppercase text-zinc-500">
            Starters
          </p>
          {hub.rotation.starters.length === 0 ? (
            <EmptyState message="No starters configured." />
          ) : (
            <ul className="mt-1">
              {hub.rotation.starters.map((row) => (
                <li
                  key={row.playerId}
                  className="flex items-center justify-between gap-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-2 font-mono text-xs text-zinc-500">
                      {row.position}
                    </span>
                    <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
                      {row.firstName} {row.lastName}
                    </PlayerEntityLink>
                  </span>
                  <span className="shrink-0 font-mono text-zinc-300">
                    {row.targetMinutes} MPG
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-4 py-2">
          <p className="font-mono text-[0.65rem] uppercase text-zinc-500">
            Bench
          </p>
          {hub.rotation.bench.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">No bench minutes set.</p>
          ) : (
            <ul className="mt-1">
              {hub.rotation.bench.map((row) => (
                <li
                  key={row.playerId}
                  className="flex items-center justify-between gap-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-2 font-mono text-xs text-zinc-500">
                      {row.position}
                    </span>
                    <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
                      {row.firstName} {row.lastName}
                    </PlayerEntityLink>
                  </span>
                  <span className="shrink-0 font-mono text-zinc-300">
                    {row.targetMinutes} MPG
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-zinc-500">
          <span>
            {hub.rotation.totalPlanned} / {hub.rotation.target} minutes
            {!hub.rotation.plannedValid ? (
              <span className="ml-2 text-amber-400">
                (Δ {hub.rotation.delta})
              </span>
            ) : null}
          </span>
          <Link
            href={rotationHref}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-zinc-200 hover:border-amber-600"
          >
            Manage Rotation
          </Link>
        </div>
      </div>
    </Section>
  );
}
