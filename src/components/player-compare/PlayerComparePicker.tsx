"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  queryTokens,
  rankMatches,
} from "@/components/game/shell/command-palette-search";
import { loadSearchIndex } from "@/components/game/shell/CommandPalette";
import { buttonClass } from "@/components/ui/Button";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { cn } from "@/components/ui/styles";
import { compareHref } from "@/presentation/player-compare";
import type { SearchIndexPlayer } from "@/state/search-index";

const LIMIT = 8;

/**
 * Players the picker can offer: no draft prospects (their ratings are hidden)
 * and not the player already in the other slot. Best match first.
 */
export function rankPickerPlayers(
  players: readonly SearchIndexPlayer[],
  query: string,
  excludeId?: string | null,
): SearchIndexPlayer[] {
  return rankMatches(
    players.filter((player) => !player.prospect && player.id !== excludeId),
    queryTokens(query),
    (player) => ({
      label: player.name,
      haystack: `${player.name} ${player.position} ${player.team}`,
    }),
    LIMIT,
  );
}

/**
 * "Change player" control for one compare slot: an input with a listbox over
 * the league search index. Choosing a player replaces the URL, keeping the
 * other slot. An empty slot opens the picker straight away.
 */
export function PlayerComparePicker(props: {
  saveId: string;
  slot: "a" | "b";
  /** The player in the other slot, kept in the URL and excluded here. */
  otherId: string | null;
  /** Empty slot: show the picker open with a prompt. */
  empty?: boolean;
  slotLabel: string;
}) {
  const { saveId, slot, otherId } = props;
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(props.empty));
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [players, setPlayers] = useState<SearchIndexPlayer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();

  useEffect(() => {
    if (!open || players) return;
    let cancelled = false;
    loadSearchIndex(saveId).then(
      (index) => {
        if (!cancelled) setPlayers(index.players);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, players, saveId]);

  useEffect(() => {
    if (open && !props.empty) inputRef.current?.focus();
  }, [open, props.empty]);

  const results = useMemo(
    () => rankPickerPlayers(players ?? [], query, otherId),
    [players, query, otherId],
  );
  const safeActive =
    results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  function choose(player: SearchIndexPlayer) {
    setOpen(false);
    setQuery("");
    router.replace(
      compareHref(saveId, {
        a: slot === "a" ? player.id : otherId,
        b: slot === "b" ? player.id : otherId,
      }),
    );
  }

  function close() {
    setOpen(false);
    setQuery("");
    buttonRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      if (props.empty) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((safeActive + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      const picked = results[safeActive];
      if (picked) choose(picked);
    }
  }

  if (!open) {
    return (
      <button
        ref={buttonRef}
        type="button"
        className={cn(buttonClass({ variant: "quiet" }), "-ml-4")}
        onClick={() => setOpen(true)}
      >
        Change player
        <span className="sr-only"> ({props.slotLabel})</span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-2">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={`Find a player for ${props.slotLabel}`}
        aria-expanded="true"
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          safeActive >= 0 ? optionId(safeActive) : undefined
        }
        autoComplete="off"
        spellCheck={false}
        placeholder="Search by name, position or team"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        className="min-h-11 w-full rounded-md border border-line-strong bg-surface-deep px-3 text-base text-ink placeholder:text-faint focus:border-team-ink focus:outline-none"
      />
      <div
        id={listboxId}
        role="listbox"
        aria-label={`Players for ${props.slotLabel}`}
        className="max-h-72 overflow-y-auto rounded-md border border-line bg-surface-raised"
      >
        {results.map((player, i) => (
          <div
            key={player.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === safeActive}
            onMouseMove={() => setActiveIndex(i)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(player)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 border-l-2 px-3 py-1.5 text-base text-ink",
              i === safeActive
                ? "border-team-ink bg-surface-high"
                : "border-transparent",
            )}
          >
            {player.overall !== null ? (
              <OvrBadge overall={player.overall} size="sm" />
            ) : (
              <span aria-hidden className="w-7 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{player.name}</span>
            <span className="shrink-0 text-sm text-muted">
              {player.position} · {player.team}
            </span>
          </div>
        ))}
      </div>
      {!players && !failed ? (
        <p role="status" className="text-sm text-muted">
          Loading players…
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-loss">
          Players could not be loaded.
        </p>
      ) : null}
      {players && results.length === 0 ? (
        <p role="status" className="text-sm text-muted">
          No matches.
        </p>
      ) : null}
    </div>
  );
}
