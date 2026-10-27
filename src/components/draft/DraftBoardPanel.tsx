import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";

type BoardEntry = {
  prospectPlayerId: string;
  name: string;
  position: string;
  rank: number;
  priority: boolean;
  notes: string;
  scoutGrade: string | null;
};

type Props = {
  saveId: string;
  entries: BoardEntry[];
  removeAction: (formData: FormData) => Promise<void>;
  togglePriorityAction: (formData: FormData) => Promise<void>;
};

export function DraftBoardPanel({
  saveId,
  entries,
  removeAction,
  togglePriorityAction,
}: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-faint">
        No prospects on your board yet. Add players from the prospect list.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.prospectPlayerId}
          className="rounded-md border border-line px-3 py-2 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink">
              #{entry.rank} {entry.name}
              {entry.priority ? (
                <span className="ml-2 text-sm font-medium text-team-ink">
                  Priority
                </span>
              ) : null}
            </span>
            <span className="text-sm text-faint">
              {entry.position} · {entry.scoutGrade ?? "—"}
            </span>
          </div>
          {entry.notes ? (
            <p className="mt-1 text-sm text-faint">{entry.notes}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3">
            <form action={togglePriorityAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input
                type="hidden"
                name="prospectPlayerId"
                value={entry.prospectPlayerId}
              />
              <button
                type="submit"
                className={cn(
                  linkClass,
                  touchTargetTextClass,
                  focusRingClass,
                  "text-sm",
                )}
              >
                {entry.priority ? "Unmark priority" : "Mark priority"}
              </button>
            </form>
            <form action={removeAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input
                type="hidden"
                name="prospectPlayerId"
                value={entry.prospectPlayerId}
              />
              <button
                type="submit"
                className={cn(
                  touchTargetTextClass,
                  focusRingClass,
                  "text-sm text-faint hover:underline",
                )}
              >
                Remove
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
