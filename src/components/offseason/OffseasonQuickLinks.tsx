import Link from "next/link";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import type { OffseasonQuickLink } from "@/state/offseason-hub-selectors";

export function OffseasonQuickLinks(props: {
  links: readonly OffseasonQuickLink[];
}) {
  return (
    <nav
      aria-label="Offseason destinations"
      className="flex flex-wrap gap-x-4 gap-y-2 text-sm"
    >
      {props.links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(linkClass, focusRingClass)}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
