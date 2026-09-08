"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  fetchPlayerDrawerViewAction,
  fetchTeamDrawerViewAction,
} from "@/application/actions";
import { PlayerDrawer } from "@/components/basketball/PlayerDrawer";
import { TeamDrawer } from "@/components/basketball/TeamDrawer";
import type {
  PlayerDrawerView,
  TeamDrawerView,
} from "@/state/entity-drawer-selectors";

type LoadStatus = "idle" | "loading" | "ready" | "error" | "missing";

type EntityDrawerContextValue = {
  openPlayer: (playerId: string) => void;
  openTeam: (teamId: string) => void;
  close: () => void;
};

const EntityDrawerContext = createContext<EntityDrawerContextValue | null>(
  null,
);

export function useEntityDrawer(): EntityDrawerContextValue {
  const ctx = useContext(EntityDrawerContext);
  if (!ctx) {
    return {
      openPlayer: () => undefined,
      openTeam: () => undefined,
      close: () => undefined,
    };
  }
  return ctx;
}

export function EntityDrawerProvider(props: {
  saveId: string;
  children: React.ReactNode;
}) {
  const [kind, setKind] = useState<"player" | "team" | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [playerView, setPlayerView] = useState<PlayerDrawerView | null>(null);
  const [teamView, setTeamView] = useState<TeamDrawerView | null>(null);
  const [status, setStatus] = useState<LoadStatus>("idle");

  const loadPlayer = useCallback(
    async (playerId: string) => {
      setStatus("loading");
      setPlayerView(null);
      try {
        const view = await fetchPlayerDrawerViewAction(
          props.saveId,
          playerId,
        );
        if (!view) {
          setStatus("missing");
          setPlayerView(null);
          return;
        }
        setPlayerView(view);
        setStatus("ready");
      } catch {
        setStatus("error");
        setPlayerView(null);
      }
    },
    [props.saveId],
  );

  const loadTeam = useCallback(
    async (teamId: string) => {
      setStatus("loading");
      setTeamView(null);
      try {
        const view = await fetchTeamDrawerViewAction(props.saveId, teamId);
        if (!view) {
          setStatus("missing");
          setTeamView(null);
          return;
        }
        setTeamView(view);
        setStatus("ready");
      } catch {
        setStatus("error");
        setTeamView(null);
      }
    },
    [props.saveId],
  );

  const openPlayer = useCallback(
    (playerId: string) => {
      setKind("player");
      setEntityId(playerId);
      void loadPlayer(playerId);
    },
    [loadPlayer],
  );

  const openTeam = useCallback(
    (teamId: string) => {
      setKind("team");
      setEntityId(teamId);
      void loadTeam(teamId);
    },
    [loadTeam],
  );

  const close = useCallback(() => {
    setKind(null);
    setEntityId(null);
    setPlayerView(null);
    setTeamView(null);
    setStatus("idle");
  }, []);

  const value = useMemo(
    () => ({ openPlayer, openTeam, close }),
    [openPlayer, openTeam, close],
  );

  return (
    <EntityDrawerContext.Provider value={value}>
      {props.children}
      <PlayerDrawer
        open={kind === "player"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        status={kind === "player" ? status : "idle"}
        view={playerView}
        onRetry={
          entityId && kind === "player"
            ? () => void loadPlayer(entityId)
            : undefined
        }
      />
      <TeamDrawer
        open={kind === "team"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        saveId={props.saveId}
        status={kind === "team" ? status : "idle"}
        view={teamView}
        onRetry={
          entityId && kind === "team"
            ? () => void loadTeam(entityId)
            : undefined
        }
      />
    </EntityDrawerContext.Provider>
  );
}
