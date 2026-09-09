import Link from "next/link";
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
          className="text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
