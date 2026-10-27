import { HubTile } from "@/components/ui/HubTile";
import { FocusGrid } from "@/components/ui/focus/FocusGrid";
import type { OffseasonQuickLink } from "@/state/offseason-hub-selectors";

export function OffseasonQuickLinks(props: {
  links: readonly OffseasonQuickLink[];
}) {
  return (
    <nav aria-label="Offseason destinations">
      <FocusGrid
        memoryKey="offseason-destinations"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        {props.links.map((link, index) => (
          <HubTile
            key={link.href}
            dense
            enterIndex={index}
            title={link.label}
            href={link.href}
          />
        ))}
      </FocusGrid>
    </nav>
  );
}
