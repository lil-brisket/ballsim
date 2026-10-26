import { GameHeader } from "@/components/game/GameHeader";
import type { DashboardSnapshot } from "@/state/selectors";
import {
  numberedHubs,
  OWNER_NAV_GROUPS,
  type OwnerNavGroup,
} from "@/application/owner-nav-config";
import { RouteTransition } from "@/components/game/RouteTransition";
import { CommandPalette } from "@/components/game/shell/CommandPalette";
import { ControlLegend } from "@/components/game/shell/ControlLegend";
import { ShellKeys } from "@/components/game/shell/ShellKeys";
import { MobileHubBar } from "@/components/game/shell/MobileHubBar";
import { ShellOffset } from "@/components/game/shell/ShellOffset";
import { SubTabBar } from "@/components/game/shell/SubTabBar";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import {
  SimulationActivityProvider,
  SimulationLockRegion,
} from "@/components/game/simulation-activity";
import { teamThemeStyle } from "@/components/ui/TeamThemeScope";

/**
 * In-save chrome: a sticky top bar (team, hubs, date, record, Sim) with the
 * active hub's sub-tabs under it, the page, and the control legend (desktop)
 * or hub bar (phones) along the bottom. Sets the controlled team's `--team-*`
 * colours on the root so everything below inherits them.
 */
export function GameShell(props: {
  saveId: string;
  saveName: string;
  dashboard: DashboardSnapshot;
  navGroups?: readonly OwnerNavGroup[];
  children: React.ReactNode;
}) {
  const branding = props.dashboard.controlledTeam.branding;
  const groups = props.navGroups ?? OWNER_NAV_GROUPS;
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
          <ShellOffset className="sticky top-0 z-40 border-b border-surface-line bg-surface-deep/90 pt-[env(safe-area-inset-top)] backdrop-blur">
            <SimulationLockRegion className="mx-auto flex w-full max-w-[100rem] flex-col gap-2 px-4 py-2 sm:px-6 lg:py-3">
              <GameHeader
                saveId={props.saveId}
                saveName={props.saveName}
                dashboard={props.dashboard}
                groups={groups}
              />
              <SubTabBar saveId={props.saveId} groups={groups} />
            </SimulationLockRegion>
          </ShellOffset>

          <main className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col px-4 pb-24 pt-6 sm:px-6 lg:pb-20 lg:pt-8">
            <RouteTransition className="flex min-w-0 flex-1 flex-col gap-8">
              {props.children}
            </RouteTransition>
          </main>

          <SimulationLockRegion className="contents">
            <MobileHubBar saveId={props.saveId} groups={groups} />
          </SimulationLockRegion>
          <ControlLegend hubCount={numberedHubs(groups).length} />
          <ShellKeys saveId={props.saveId} groups={groups} />
          <CommandPalette saveId={props.saveId} groups={groups} />
        </div>
      </SimulationActivityProvider>
    </EntityDrawerProvider>
  );
}
