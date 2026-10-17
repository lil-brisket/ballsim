import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import type { PhaseFocus, PhaseTask } from "@/state/phase-dashboard";

export function PhaseFocusList(props: { focus: PhaseFocus[] }) {
  if (props.focus.length === 0) {
    return null;
  }
  return (
    <section aria-label="Phase focus" className="space-y-2">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
        Focus
      </p>
      <ul className="space-y-2">
        {props.focus.map((item) => (
          <li
            key={item.focusKey}
            className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2"
          >
            <p className="text-sm font-medium text-zinc-100">{item.title}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{item.explanation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PhaseTaskList(props: {
  tasks: PhaseTask[];
  saveId: string;
  returnPath: string;
  dismissAction?: (formData: FormData) => void | Promise<void>;
}) {
  if (props.tasks.length === 0) {
    return null;
  }

  return (
    <section aria-label="Phase tasks" className="space-y-2">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
        Tasks
      </p>
      <ul className="space-y-2">
        {props.tasks.map((task) => (
          <li
            key={task.taskKey}
            className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-zinc-50">
                  <PriorityMark priority={task.priority} /> {task.title}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{task.explanation}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={task.href}
                  className={buttonClass({ variant: "secondary" })}
                >
                  Open
                </Link>
                {task.priority !== "required" && props.dismissAction ? (
                  <form action={props.dismissAction}>
                    <input type="hidden" name="saveId" value={props.saveId} />
                    <input
                      type="hidden"
                      name="returnPath"
                      value={props.returnPath}
                    />
                    <input type="hidden" name="taskKey" value={task.taskKey} />
                    <button
                      type="submit"
                      className={buttonClass({ variant: "quiet" })}
                    >
                      Dismiss
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PriorityMark(props: { priority: PhaseTask["priority"] }) {
  if (props.priority === "required") {
    return <span className="text-red-400">●</span>;
  }
  if (props.priority === "recommended") {
    return <span className="text-warning">●</span>;
  }
  return <span className="text-sky-400">●</span>;
}
