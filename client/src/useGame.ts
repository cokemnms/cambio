import { useCallback, useEffect, useRef, useState } from "react";
import type { GameStateView, SlotRef } from "@cambio/shared";
import { clientId, emit, socket } from "./net/client";

export interface Notice {
  id: number;
  message: string;
  kind: "info" | "warn" | "error";
}

export function useGame() {
  const [connected, setConnected] = useState(socket.connected);
  const [view, setView] = useState<GameStateView | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeId = useRef(0);

  const pushNotice = useCallback(
    (message: string, kind: Notice["kind"] = "info") => {
      const id = ++noticeId.current;
      setNotices((n) => [...n, { id, message, kind }]);
      setTimeout(() => {
        setNotices((n) => n.filter((x) => x.id !== id));
      }, 3200);
    },
    []
  );

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState = (v: GameStateView) => setView(v);
    const onNotice = (p: { message: string; kind?: Notice["kind"] }) =>
      pushNotice(p.message, p.kind ?? "info");
    const onClosed = (p: { reason: string }) => {
      pushNotice(p.reason, "warn");
      setView(null);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state", onState);
    socket.on("notice", onNotice);
    socket.on("roomClosed", onClosed);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state", onState);
      socket.off("notice", onNotice);
      socket.off("roomClosed", onClosed);
    };
  }, [pushNotice]);

  // Wrap an action so failures surface as a notice.
  const run = useCallback(
    async (
      event: Parameters<typeof emit>[0],
      payload?: unknown
    ): Promise<boolean> => {
      const res = await emit(event, payload);
      if (!res.ok && res.error) pushNotice(res.error, "error");
      return res.ok;
    },
    [pushNotice]
  );

  const actions = {
    createRoom: async (name: string) => {
      const res = await emit<{ roomCode: string }>("createRoom", { name });
      if (!res.ok && res.error) pushNotice(res.error, "error");
      return res.ok;
    },
    joinRoom: async (code: string, name: string) => {
      const res = await emit<{ roomCode: string }>("joinRoom", {
        code: code.toUpperCase(),
        name,
      });
      if (!res.ok && res.error) pushNotice(res.error, "error");
      return res.ok;
    },
    leaveRoom: () => run("leaveRoom"),
    startGame: () => run("startGame"),
    peekCard: (slot: number) => run("peekCard", { slot }),
    peekReady: () => run("peekReady"),
    drawFromDeck: () => run("drawFromDeck"),
    takeFromDiscard: () => run("takeFromDiscard"),
    swapHeld: (slot: number) => run("swapHeld", { slot }),
    discardHeld: () => run("discardHeld"),
    powerPeek: (target: SlotRef) => run("powerPeek", { target }),
    powerSwap: (first: SlotRef, second: SlotRef) =>
      run("powerSwap", { first, second }),
    powerSkip: () => run("powerSkip"),
    snap: (slot: number) => run("snap", { slot }),
    callCambio: () => run("callCambio"),
    rematch: () => run("rematch"),
  };

  return { connected, view, notices, actions, youId: clientId };
}

export type GameActions = ReturnType<typeof useGame>["actions"];
