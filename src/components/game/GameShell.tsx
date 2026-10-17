import { GameHeader } from "@/components/game/GameHeader";
import type { DashboardSnapshot } from "@/state/selectors";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { DesktopNavigation } from "@/components/game/DesktopNavigation";
import { MobileNavigationDrawer } from "@/components/game/MobileNavigationDrawer";
import { RouteTransition } from "@/components/game/RouteTransition";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import {
  SimulationActivityProvider,
  SimulationLockRegion,
} from "@/components/game/simulation-activity";
import { teamThemeStyle } from "@/components/ui/TeamThemeScope";

/**
 * In-save chrome. Sets the controlled team's `--team-*` colours on the root so
 * the header, nav and every page below inherit them.
 */
export function GameShell(props: {
  saveId: string;
  saveName: string;
  dashboard: DashboardSnapshot;
  navGroups?: readonly OwnerNavGroup[];
  children: React.ReactNode;
}) {
  const branding = props.dashboard.controlledTeam.branding;
  return (
    <EntityDrawerProvider saveId={props.saveId}>
      <SimulationActivityProvider>
        <div
          className="shell-backdrop relative isolate flex min-h-full flex-1 flex-col"
          style={teamThemeStyle(branding)}
        >
          <div
            aria-hidden="true"
            data-testid="shell-spotlight"
            className="shell-spotlight"
          />
          <div className="sticky top-0 z-40 border-b border-surface-line bg-surface-deep/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:pt-0 lg:backdrop-blur-none">
            <SimulationLockRegion className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-6 lg:pb-0 lg:pt-8">
              <GameHeader
                saveId={props.saveId}
                saveName={props.saveName}
                dashboard={props.dashboard}
                menu={
                  <MobileNavigationDrawer
                    saveId={props.saveId}
                    groups={props.navGroups}
                    branding={branding}
                    compact
                  />
                }
              />
            </SimulationLockRegion>
          </div>

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <SimulationLockRegion className="contents">
                <DesktopNavigation
                  saveId={props.saveId}
                  groups={props.navGroups}
                />
              </SimulationLockRegion>
              <RouteTransition className="flex min-w-0 flex-1 flex-col gap-8">
                {props.children}
              </RouteTransition>
            </div>
          </div>
        </div>
      </SimulationActivityProvider>
    </EntityDrawerProvider>
  );
}
