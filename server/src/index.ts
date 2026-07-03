import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import type {
  Ack,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@cambio/shared";
import { GameError } from "./game/engine.js";
import { Room, RoomManager, type SocketData } from "./rooms.js";

const PORT = Number(process.env.PORT ?? 3001);
const ORIGIN = process.env.CLIENT_ORIGIN ?? "*";

const app = express();
app.use(cors({ origin: ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: { origin: ORIGIN },
});

const rooms = new RoomManager(io);

/** Wrap a handler so thrown GameErrors become ack errors, not crashes. */
function guard(
  ack: ((r: Ack<any>) => void) | undefined,
  fn: () => any
): void {
  try {
    const data = fn();
    ack?.({ ok: true, data });
  } catch (err) {
    const message =
      err instanceof GameError
        ? err.message
        : (console.error(err), "Something went wrong");
    ack?.({ ok: false, error: message });
  }
}

io.on("connection", (socket) => {
  const clientId = String(socket.handshake.auth?.clientId ?? socket.id);
  socket.data.clientId = clientId;

  const currentRoom = (): Room | undefined => {
    const code = socket.data.roomCode;
    return code ? rooms.getRoom(code) : undefined;
  };

  // Run an action against the current room, then broadcast the new state.
  const act = (ack: ((r: Ack) => void) | undefined, fn: (room: Room) => void) =>
    guard(ack, () => {
      const room = currentRoom();
      if (!room) throw new GameError("You are not in a room");
      fn(room);
      rooms.broadcast(room);
    });

  socket.on("createRoom", ({ name }, ack) => {
    guard(ack, () => {
      const room = rooms.createRoom();
      rooms.join(room, socket, clientId, name?.trim() || "Player");
      rooms.broadcast(room);
      return { roomCode: room.code, youId: clientId };
    });
  });

  socket.on("joinRoom", ({ code, name }, ack) => {
    guard(ack, () => {
      const room = rooms.getRoom(code);
      if (!room) throw new GameError("Room not found");
      if (
        room.game.phase !== "lobby" &&
        !room.game.players.find((p) => p.id === clientId)
      ) {
        throw new GameError("That game has already started");
      }
      rooms.join(room, socket, clientId, name?.trim() || "Player");
      rooms.broadcast(room);
      return { roomCode: room.code, youId: clientId };
    });
  });

  socket.on("leaveRoom", (ack) => guard(ack, () => rooms.leaveRoom(socket)));

  socket.on("startGame", (ack) =>
    act(ack, (room) => room.game.startRound(clientId))
  );
  socket.on("peekCard", ({ slot }, ack) =>
    act(ack, (room) => room.game.peekCard(clientId, slot))
  );
  socket.on("peekReady", (ack) =>
    act(ack, (room) => room.game.peekReady(clientId))
  );
  socket.on("drawFromDeck", (ack) =>
    act(ack, (room) => room.game.drawFromDeck(clientId))
  );
  socket.on("takeFromDiscard", (ack) =>
    act(ack, (room) => room.game.takeFromDiscard(clientId))
  );
  socket.on("swapHeld", ({ slot }, ack) =>
    act(ack, (room) => room.game.swapHeld(clientId, slot))
  );
  socket.on("discardHeld", (ack) =>
    act(ack, (room) => room.game.discardHeld(clientId))
  );
  socket.on("powerPeek", ({ target }, ack) =>
    act(ack, (room) => room.game.powerPeek(clientId, target))
  );
  socket.on("powerSwap", ({ first, second }, ack) =>
    act(ack, (room) => room.game.powerSwap(clientId, first, second))
  );
  socket.on("powerSkip", (ack) =>
    act(ack, (room) => room.game.powerSkip(clientId))
  );
  socket.on("snap", ({ slot }, ack) =>
    act(ack, (room) => room.game.snap(clientId, slot))
  );
  socket.on("callCambio", (ack) =>
    act(ack, (room) => room.game.callCambio(clientId))
  );
  socket.on("rematch", (ack) =>
    act(ack, (room) => room.game.rematch(clientId))
  );

  socket.on("disconnect", () => rooms.leaveSocket(socket));
});

httpServer.listen(PORT, () => {
  console.log(`Cambio server listening on :${PORT}`);
});
