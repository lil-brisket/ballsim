import { ErrorState } from "@/components/owner/EmptyState";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import { TeamHubHeader } from "@/components/team/hub/TeamHubHeader";
import { TeamOverview } from "@/components/team/hub/TeamOverview";
import { TeamRecentHistory } from "@/components/team/hub/TeamRecentHistory";
import { TeamRosterPreview } from "@/components/team/hub/TeamRosterPreview";
import { TeamRotationPreview } from "@/components/team/hub/TeamRotationPreview";
import type { TeamHubView } from "@/state/team-hub-selectors";

/**
 * Team Hub shell — server component; sections + lists, not a card dashboard.
 */
export function TeamHub(props: {
  saveId: string;
  hub: TeamHubView;
  error?: string;
}) {
  const { saveId, hub, error } = props;

  return (
    <div className="space-y-8">
      <TeamHubSubNav saveId={saveId} active="team" />
      <TeamHubHeader hub={hub} />
      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <TeamOverview hub={hub} />
          <TeamRecentHistory saveId={saveId} items={hub.recentHistory} />
        </div>
        <div className="space-y-8">
          <TeamRotationPreview saveId={saveId} hub={hub} />
          <TeamRosterPreview saveId={saveId} hub={hub} />
        </div>
      </div>
    </div>
  );
}
