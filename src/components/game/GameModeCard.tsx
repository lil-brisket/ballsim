import Link from "next/link";
import type { GameModeDefinition } from "@/application/game-mode-catalog";
import { StatusBadge } from "@/components/owner/StatusBadge";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

export function GameModeCard(props: { mode: GameModeDefinition }) {
  const { mode } = props;
  const isOwner = mode.id === "owner";
  const availableClasses = isOwner
    ? "border-amber-700/50 bg-zinc-900/80 hover:border-amber-500 hover:bg-zinc-900"
    : "border-zinc-700 bg-zinc-900/70 hover:border-zinc-500 hover:bg-zinc-900";
  const unavailableClasses =
    "border-zinc-800 bg-zinc-900/40 opacity-90 cursor-default";

  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
            {mode.name}
          </h2>
          <p className="text-sm font-medium text-amber-400/90">{mode.tagline}</p>
        </div>
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
      <p
        className={`mt-auto text-sm font-medium ${
          mode.available ? "text-amber-400" : "text-zinc-500"
        }`}
      >
        {mode.available ? `${mode.actionLabel} →` : mode.actionLabel}
      </p>
    </>
  );

  if (mode.available && mode.entryHref) {
    return (
      <Link
        href={mode.entryHref}
        className={`flex flex-col gap-4 rounded-xl border p-6 transition-colors ${availableClasses} ${focusRing}`}
        aria-label={`${mode.name}. ${mode.tagline} ${mode.actionLabel}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <article
      className={`flex flex-col gap-4 rounded-xl border p-6 ${unavailableClasses}`}
      aria-disabled="true"
    >
      {body}
    </article>
  );
}
