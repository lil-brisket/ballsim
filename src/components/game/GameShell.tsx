import type { DashboardSnapshot } from "@/state/selectors";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { GameHeader } from "@/components/game/GameHeader";
import { GameNavigation } from "@/components/game/GameNavigation";

export function GameShell(props: {
  saveId: string;
  saveName: string;
  dashboard: DashboardSnapshot;
  navGroups?: readonly OwnerNavGroup[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <GameHeader saveName={props.saveName} dashboard={props.dashboard} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <GameNavigation
          saveId={props.saveId}
          unreadCount={props.dashboard.unreadNotificationCount}
          groups={props.navGroups}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-8">{props.children}</div>
      </div>
    </div>
  );
}
