"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import type { SearchIndex } from "@/state/search-index";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import {
  matchesTokens,
  queryTokens,
  rankMatches,
} from "@/components/game/shell/command-palette-search";
import {
  OPEN_COMMAND_PALETTE,
  simHref,
} from "@/components/game/shell/hub-keys";
import { useActiveNav } from "@/components/game/shell/use-active-nav";
import {
  acquireDrawerScrollLock,
  releaseDrawerScrollLock,
} from "@/components/ui/drawer-scroll-lock";
import { playUiSound } from "@/components/ui/sound/ui-sound";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { cn } from "@/components/ui/styles";

type GroupId = "pages" | "actions" | "players" | "teams";

type PaletteItem = {
  key: string;
  group: GroupId;
  label: string;
  /** Text every query token must match. */
  haystack: string;
  run: () => void;
  player?: SearchIndex["players"][number];
  team?: SearchIndex["teams"][number];
};

const GROUP_LABEL: Record<GroupId, string> = {
  pages: "Pages",
  actions: "Actions",
  players: "Players",
  teams: "Teams",
};
const GROUP_ORDER: GroupId[] = ["pages", "actions", "players", "teams"];
const LIMIT: Record<"pages" | "players" | "teams", number> = {
  pages: 8,
  players: 8,
  teams: 5,
};

type IndexState = "idle" | "loading" | "ready" | "error";

const indexCache = new Map<string, SearchIndex>();
const indexRequests = new Map<string, Promise<SearchIndex>>();

/** Test helper: forget fetched indexes. */
export function resetSearchIndexCacheForTests(): void {
  indexCache.clear();
  indexRequests.clear();
}

/** Fetch (and cache per save) the league search index. */
export function loadSearchIndex(saveId: string): Promise<SearchIndex> {
  const cached = indexCache.get(saveId);
  if (cached) return Promise.resolve(cached);
  const pending = indexRequests.get(saveId);
  if (pending) return pending;
  const request = fetch(`/dashboard/${saveId}/search-index`, {
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new Error("Search index unavailable");
      return response.json() as Promise<SearchIndex>;
    })
    .then((index) => {
      indexCache.set(saveId, index);
      return index;
    })
    .finally(() => {
      indexRequests.delete(saveId);
    });
  indexRequests.set(saveId, request);
  return request;
}

/**
 * Keyboard-first search for the save: pages, navigation shortcuts, players and
 * teams. Opens on the OPEN_COMMAND_PALETTE window event (`/`, Ctrl/Cmd+K or
 * the header button). Actions only navigate, so every confirm rule on the
 * destination still applies.
 */
export function CommandPalette(props: {
  saveId: string;
  groups: readonly OwnerNavGroup[];
}) {
  const { saveId, groups } = props;
  const router = useRouter();
  const drawer = useEntityDrawer();
  const active = useActiveNav(saveId, groups);
  const currentHubId = active?.hub.id;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [indexState, setIndexState] = useState<IndexState>("idle");

  const baseId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onOpen() {
      if (openRef.current) return;
      openRef.current = true;
      setQuery("");
      setActiveIndex(0);
      setOpen(true);

      const cached = indexCache.get(saveId);
      if (cached) {
        setIndex(cached);
        setIndexState("ready");
        return;
      }
      setIndexState("loading");
      loadSearchIndex(saveId).then(
        (loaded) => {
          setIndex(loaded);
          setIndexState("ready");
        },
        () => setIndexState("error"),
      );
    }
    window.addEventListener(OPEN_COMMAND_PALETTE, onOpen);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE, onOpen);
  }, [saveId]);

  useEffect(() => {
    openRef.current = open;
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    acquireDrawerScrollLock();
    inputRef.current?.focus();
    return () => {
      releaseDrawerScrollLock();
      previous?.focus();
    };
  }, [open]);

  const navigate = useCallback(
    (path: string) => {
      close();
      router.push(`/dashboard/${saveId}${path}`);
    },
    [close, router, saveId],
  );

  const pageItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    for (const hub of groups) {
      for (const tab of hub.items) {
        const label =
          tab.label === hub.label ? hub.label : `${hub.label} › ${tab.label}`;
        items.push({
          key: `page:${hub.id}:${tab.href}`,
          group: "pages",
          label,
          haystack: label,
          run: () => navigate(tab.href),
        });
      }
    }
    return items;
  }, [groups, navigate]);

  const actionItems = useMemo<PaletteItem[]>(() => {
    const base = `/dashboard/${saveId}`;
    const sim = simHref(saveId);
    const entries: Array<[string, string]> = [
      ["Sim to next game", sim.startsWith(base) ? sim.slice(base.length) : sim],
      // Opens the calendar on the deadline; the day's "Sim to this day" confirm
      // runs the sim, like every other sim path.
      ["Sim to trade deadline", "/calendar?focus=trade-deadline"],
      ["Open Free Agency", "/free-agency"],
      ["Find a trade", "/roster?tab=trade-finder"],
      ["Compare players", "/players/compare"],
      ["Open notifications", "/notifications"],
    ];
    return entries.map(([label, path]) => ({
      key: `action:${path}`,
      group: "actions" as const,
      label,
      haystack: label,
      run: () => navigate(path),
    }));
  }, [saveId, navigate]);

  const results = useMemo<PaletteItem[]>(() => {
    const tokens = queryTokens(query);
    const text = (item: PaletteItem) => ({
      label: item.label,
      haystack: item.haystack,
    });
    if (tokens.length === 0) {
      const hubPages = pageItems.filter((item) =>
        item.key.startsWith(`page:${currentHubId}:`),
      );
      return [...hubPages, ...actionItems];
    }
    const pages = rankMatches(pageItems, tokens, text, LIMIT.pages);
    const actions = actionItems.filter((item) =>
      matchesTokens(item.haystack, tokens),
    );
    const players = rankMatches(
      (index?.players ?? []).map<PaletteItem>((player) => ({
        key: `player:${player.id}`,
        group: "players",
        label: player.name,
        haystack: `${player.name} ${player.position} ${player.team}`,
        player,
        run: () => {
          close();
          if (player.prospect) {
            router.push(`/dashboard/${saveId}/draft`);
          } else {
            drawer.openPlayer(player.id);
          }
        },
      })),
      tokens,
      text,
      LIMIT.players,
    );
    const teams = rankMatches(
      (index?.teams ?? []).map<PaletteItem>((team) => ({
        key: `team:${team.id}`,
        group: "teams",
        label: team.name,
        haystack: `${team.name} ${team.abbreviation}`,
        team,
        run: () => {
          close();
          drawer.openTeam(team.id);
        },
      })),
      tokens,
      text,
      LIMIT.teams,
    );
    return [...pages, ...actions, ...players, ...teams];
  }, [
    query,
    pageItems,
    actionItems,
    currentHubId,
    index,
    close,
    drawer,
    router,
    saveId,
  ]);

  const safeActive =
    results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);

  useEffect(() => {
    if (!open || safeActive < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${safeActive}"]`,
    );
    node?.scrollIntoView?.({ block: "nearest" });
  }, [open, safeActive]);

  if (!open) return null;

  const optionId = (i: number) => `${baseId}-option-${i}`;
  const listboxId = `${baseId}-listbox`;
  const searching = query.trim().length > 0;

  function runItem(item: PaletteItem | undefined) {
    if (!item) return;
    playUiSound("select");
    item.run();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
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
      runItem(results[safeActive]);
    } else if (event.key === "Tab") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  }

  const rows: React.ReactNode[] = [];
  let position = 0;
  for (const group of GROUP_ORDER) {
    const items = results.filter((item) => item.group === group);
    if (items.length === 0) continue;
    const headingId = `${baseId}-group-${group}`;
    rows.push(
      <div key={group} role="group" aria-labelledby={headingId}>
        <p
          id={headingId}
          className="px-4 pb-1 pt-3 text-sm font-semibold text-muted"
        >
          {GROUP_LABEL[group]}
        </p>
        {items.map((item) => {
          const i = position++;
          const isActive = i === safeActive;
          return (
            <div
              key={item.key}
              id={optionId(i)}
              role="option"
              aria-selected={isActive}
              data-option-index={i}
              onMouseMove={() => {
                if (!isActive) setActiveIndex(i);
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runItem(item)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 border-l-2 px-4 py-1.5 text-base text-ink",
                isActive
                  ? "border-team-ink bg-surface-high"
                  : "border-transparent",
              )}
            >
              {item.player ? (
                <>
                  {item.player.overall !== null ? (
                    <OvrBadge overall={item.player.overall} size="sm" />
                  ) : (
                    <span aria-hidden className="w-7 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {item.player.name}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {item.player.position} · {item.player.team}
                  </span>
                </>
              ) : item.team ? (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    {item.team.name}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {item.team.abbreviation}
                  </span>
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              )}
            </div>
          );
        })}
      </div>,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[max(1rem,10dvh)]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close search"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKeyDown}
        className="relative z-10 flex max-h-[min(80dvh,36rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface-raised shadow-xl"
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search pages, players and teams"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            safeActive >= 0 ? optionId(safeActive) : undefined
          }
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search pages, players, teams"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          className="min-h-14 w-full shrink-0 border-b border-line bg-transparent px-4 font-display text-lg text-ink placeholder:text-faint focus:outline-none"
        />
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto pb-2">
          <div id={listboxId} role="listbox" aria-label="Results">
            {rows}
          </div>
          {searching && indexState === "loading" ? (
            <p role="status" className="px-4 py-2 text-sm text-muted">
              Loading players…
            </p>
          ) : null}
          {searching && indexState === "error" ? (
            <p role="alert" className="px-4 py-2 text-sm text-loss">
              Players and teams could not be loaded.
            </p>
          ) : null}
          {searching && results.length === 0 && indexState !== "loading" ? (
            <p role="status" className="px-4 py-3 text-sm text-muted">
              No matches.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
