import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerSave } from "@/application/game-service";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { TeamBadge } from "@/components/owner/TeamBadge";

type OwnerLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ saveId: string }>;
};

export default async function OwnerLayout({
  children,
  params,
}: OwnerLayoutProps) {
  const { saveId } = await params;
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    notFound();
  }

  const { save, dashboard } = loaded;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-sm text-zinc-400 hover:text-amber-400">
          ← Saves
        </Link>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          Owner Mode
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <TeamBadge
          city={dashboard.controlledTeam.city}
          name={dashboard.controlledTeam.name}
          abbreviation={dashboard.controlledTeam.abbreviation}
        />
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600">Date</p>
            <p className="font-mono text-zinc-200">{dashboard.currentDate}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Season
            </p>
            <p className="text-zinc-200">
              {dashboard.seasonYear} · {dashboard.seasonPhase}
              {dashboard.offseasonStage !== "none"
                ? ` / ${dashboard.offseasonStage}`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600">Cash</p>
            <MoneyDisplay amount={dashboard.cash} className="text-zinc-200" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Payroll
            </p>
            <MoneyDisplay
              amount={dashboard.payroll}
              className="text-zinc-200"
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Save
            </p>
            <p className="text-zinc-300">{save.name}</p>
          </div>
        </div>
      </div>

      <OwnerNav
        saveId={saveId}
        unreadCount={dashboard.unreadNotificationCount}
      />

      <div className="flex flex-1 flex-col gap-8">{children}</div>
    </div>
  );
}
