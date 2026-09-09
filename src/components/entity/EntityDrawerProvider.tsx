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
  fetchStaffDrawerViewAction,
  fetchTeamDrawerViewAction,
} from "@/application/actions";
import { PlayerDrawer } from "@/components/basketball/PlayerDrawer";
import { StaffDrawer } from "@/components/basketball/StaffDrawer";
import { TeamDrawer } from "@/components/basketball/TeamDrawer";
import type {
  PlayerDrawerView,
  StaffDrawerView,
  TeamDrawerView,
} from "@/state/entity-drawer-selectors";

type LoadStatus = "idle" | "loading" | "ready" | "error" | "missing";

type EntityDrawerContextValue = {
  openPlayer: (playerId: string) => void;
  openTeam: (teamId: string) => void;
  openStaff: (staffId: string) => void;
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
      openStaff: () => undefined,
      close: () => undefined,
    };
  }
  return ctx;
}

export function EntityDrawerProvider(props: {
  saveId: string;
  children: React.ReactNode;
}) {
  const [kind, setKind] = useState<"player" | "team" | "staff" | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [playerView, setPlayerView] = useState<PlayerDrawerView | null>(null);
  const [teamView, setTeamView] = useState<TeamDrawerView | null>(null);
  const [staffView, setStaffView] = useState<StaffDrawerView | null>(null);
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

  const loadStaff = useCallback(
    async (staffId: string) => {
      setStatus("loading");
      setStaffView(null);
      try {
        const view = await fetchStaffDrawerViewAction(props.saveId, staffId);
        if (!view) {
          setStatus("missing");
          setStaffView(null);
          return;
        }
        setStaffView(view);
        setStatus("ready");
      } catch {
        setStatus("error");
        setStaffView(null);
      }
    },
    [props.saveId],
  );

  const openPlayer = useCallback(
    (playerId: string) => {
      setKind("player");
      setEntityId(playerId);
      setTeamView(null);
      setStaffView(null);
      void loadPlayer(playerId);
    },
    [loadPlayer],
  );

  const openTeam = useCallback(
    (teamId: string) => {
      setKind("team");
      setEntityId(teamId);
      setPlayerView(null);
      setStaffView(null);
      void loadTeam(teamId);
    },
    [loadTeam],
  );

  const openStaff = useCallback(
    (staffId: string) => {
      setKind("staff");
      setEntityId(staffId);
      setPlayerView(null);
      setTeamView(null);
      void loadStaff(staffId);
    },
    [loadStaff],
  );

  const close = useCallback(() => {
    setKind(null);
    setEntityId(null);
    setPlayerView(null);
    setTeamView(null);
    setStaffView(null);
    setStatus("idle");
  }, []);

  const value = useMemo(
    () => ({ openPlayer, openTeam, openStaff, close }),
    [openPlayer, openTeam, openStaff, close],
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
      <StaffDrawer
        open={kind === "staff"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        status={kind === "staff" ? status : "idle"}
        view={staffView}
        onRetry={
          entityId && kind === "staff"
            ? () => void loadStaff(entityId)
            : undefined
        }
      />
    </EntityDrawerContext.Provider>
  );
}
