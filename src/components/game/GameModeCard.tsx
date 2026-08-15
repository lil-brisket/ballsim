import Link from "next/link";
import type { GameModeDefinition } from "@/application/game-mode-catalog";
import { StatusBadge } from "@/components/owner/StatusBadge";

export function GameModeCard(props: { mode: GameModeDefinition }) {
  const { mode } = props;
  return (
    <article
      className={`flex flex-col gap-4 rounded-xl border p-6 ${
        mode.available
          ? "border-zinc-700 bg-zinc-900/70"
          : "border-zinc-800 bg-zinc-900/40 opacity-80"
      }`}
      aria-disabled={!mode.available}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-50">{mode.name}</h2>
        <StatusBadge
          label={mode.statusLabel}
          tone={mode.available ? "success" : "info"}
        />
      </div>
      <p className="text-sm leading-relaxed text-zinc-400">{mode.description}</p>
      <ul className="space-y-1.5 text-sm text-zinc-300">
        {mode.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="text-amber-500" aria-hidden>
              •
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {mode.available && mode.href ? (
        <Link
          href={mode.href}
          className="mt-auto inline-flex w-fit rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Select {mode.name}
        </Link>
      ) : (
        <p className="mt-auto text-sm text-zinc-500">Not available yet.</p>
      )}
    </article>
  );
}
