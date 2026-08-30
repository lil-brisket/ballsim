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
      <p className="text-sm text-zinc-500">
        No prospects on your board yet. Add players from the prospect list.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.prospectPlayerId}
          className="rounded-md border border-zinc-800 px-3 py-2 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-zinc-100">
              #{entry.rank} {entry.name}
              {entry.priority ? (
                <span className="ml-2 text-[10px] uppercase text-amber-400">
                  Priority
                </span>
              ) : null}
            </span>
            <span className="text-xs text-zinc-500">
              {entry.position} · {entry.scoutGrade ?? "—"}
            </span>
          </div>
          {entry.notes ? (
            <p className="mt-1 text-xs text-zinc-500">{entry.notes}</p>
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
                className="text-xs text-amber-400 hover:underline"
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
                className="text-xs text-zinc-500 hover:underline"
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
