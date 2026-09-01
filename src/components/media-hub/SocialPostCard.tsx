import { StatusBadge } from "@/components/owner/StatusBadge";
import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { SocialAuthorType } from "@/domain/entities/social-post";

export type SocialPostCardProps = {
  id: string;
  occurredOn: string;
  authorType: SocialAuthorType;
  authorLabel: string;
  content: string;
  importance: ImportanceLevel;
};

function importanceTone(level: ImportanceLevel): string {
  switch (level) {
    case "critical":
      return "critical";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "neutral";
  }
}

export function SocialPostCard(props: SocialPostCardProps) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">
              {props.authorLabel}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              {props.authorType}
            </span>
            <StatusBadge
              label={props.importance}
              tone={importanceTone(props.importance)}
            />
          </div>
          <p className="text-sm text-zinc-300">{props.content}</p>
        </div>
      </div>
      <p className="mt-2 font-mono text-xs text-zinc-600">{props.occurredOn}</p>
    </article>
  );
}
