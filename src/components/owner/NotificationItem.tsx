import Link from "next/link";
import { formatGameDate } from "@/presentation/game-date";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function NotificationItem(props: {
  id: string;
  title: string;
  message: string;
  occurredOn: string;
  severity: string;
  read: boolean;
  href?: string;
}) {
  const body = (
    <div
      className={`rounded-lg border px-4 py-3 ${
        props.read
          ? "border-zinc-800 bg-zinc-900/40"
          : "border-team-ink/50 bg-team/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{props.title}</p>
          <p className="mt-1 text-sm text-zinc-400">{props.message}</p>
        </div>
        <StatusBadge label={props.severity} tone={props.severity} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {formatGameDate(props.occurredOn, { year: true })}
      </p>
    </div>
  );

  if (props.href) {
    return (
      <Link href={props.href} className="block hover:opacity-90">
        {body}
      </Link>
    );
  }
  return body;
}
