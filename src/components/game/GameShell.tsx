import { GameHeader } from "@/components/game/GameHeader";
import type { DashboardSnapshot } from "@/state/selectors";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { DesktopNavigation } from "@/components/game/DesktopNavigation";
import { MobileNavigationDrawer } from "@/components/game/MobileNavigationDrawer";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { SimulationActivityProvider } from "@/components/game/simulation-activity";

export function GameShell(props: {
  saveId: string;
  saveName: string;
  dashboard: DashboardSnapshot;
  navGroups?: readonly OwnerNavGroup[];
  children: React.ReactNode;
}) {
  return (
    <EntityDrawerProvider saveId={props.saveId}>
      <SimulationActivityProvider>
        <div className="flex min-h-full flex-1 flex-col">
          <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:pt-0 lg:backdrop-blur-none">
            <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-6 lg:pb-0 lg:pt-8">
              <GameHeader
                saveId={props.saveId}
                saveName={props.saveName}
                dashboard={props.dashboard}
                menu={
                  <MobileNavigationDrawer
                    saveId={props.saveId}
                    groups={props.navGroups}
                    compact
                  />
                }
              />
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <DesktopNavigation
                saveId={props.saveId}
                groups={props.navGroups}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-8">
                {props.children}
              </div>
            </div>
          </div>
        </div>
      </SimulationActivityProvider>
    </EntityDrawerProvider>
  );
}
