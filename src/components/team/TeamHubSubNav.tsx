import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";

const LINKS = [
  { suffix: "/team", label: "Team Hub" },
  { suffix: "/roster", label: "Roster" },
  { suffix: "/team-management/rotations", label: "Rotation" },
  { suffix: "/team-management/lineups", label: "Lineups" },
] as const;

export function TeamHubSubNav(props: {
  saveId: string;
  active: "team" | "roster" | "rotation" | "lineups";
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <nav
      aria-label="Team management"
      className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3"
    >
      {LINKS.map((link) => {
        const key = link.label.toLowerCase().includes("hub")
          ? "team"
          : link.label.toLowerCase() === "roster"
            ? "roster"
            : link.label.toLowerCase() === "rotation"
              ? "rotation"
              : "lineups";
        const active = key === props.active;
        return (
          <Link
            key={link.suffix}
            href={`${base}${link.suffix}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              focusRingClass,
              active
                ? "bg-amber-600/20 text-amber-300"
                : "text-zinc-400 hover:text-zinc-200",
            )}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
