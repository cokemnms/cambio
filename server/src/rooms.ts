import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@cambio/shared";
import { Game } from "./game/engine.js";
import { makeRoomCode } from "./util/ids.js";

export interface SocketData {
  clientId: string;
  roomCode?: string;
}

type IO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type Sock = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const EMPTY_ROOM_TTL_MS = 1000 * 60 * 10; // reap empty rooms after 10 min

export class Room {
  code: string;
  game: Game;
  /** clientId -> socketId (present only while connected). */
  sockets = new Map<string, string>();
  emptySince: number | null = null;

  constructor(code: string) {
    this.code = code;
    this.game = new Game();
  }

  broadcast(io: IO): void {
    this.game.clearExpiredReveals();
    for (const [clientId, socketId] of this.sockets) {
      const view = this.game.buildView(clientId);
      view.roomCode = this.code;
      io.to(socketId).emit("state", view);
    }
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();

  constructor(private io: IO) {
    const timer = setInterval(() => this.reapEmptyRooms(), 60_000);
    (timer as { unref?: () => void }).unref?.();
  }

  createRoom(): Room {
    let code = makeRoomCode();
    while (this.rooms.has(code)) code = makeRoomCode();
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** Attach a socket to a room as `clientId`, joining or reconnecting. */
  join(room: Room, socket: Sock, clientId: string, name: string): void {
    const existing = room.game.players.find((p) => p.id === clientId);
    if (existing) {
      existing.connected = true;
      if (name) existing.name = name;
    } else {
      room.game.addPlayer(clientId, name);
    }
    room.sockets.set(clientId, socket.id);
    room.emptySince = null;
    (socket.data as SocketData).roomCode = room.code;
    socket.join(room.code);
  }

  /** Detach a socket (disconnect). Keeps the seat for reconnection. */
  leaveSocket(socket: Sock): void {
    const data = socket.data as SocketData;
    const room = data.roomCode ? this.rooms.get(data.roomCode) : undefined;
    if (!room) return;
    const clientId = data.clientId;
    if (room.sockets.get(clientId) === socket.id) {
      room.sockets.delete(clientId);
    }
    room.game.setConnected(clientId, false);
    if (room.sockets.size === 0) room.emptySince = Date.now();
    this.broadcast(room);
  }

  /** Explicit leave (button) — actually removes the player. */
  leaveRoom(socket: Sock): void {
    const data = socket.data as SocketData;
    const room = data.roomCode ? this.rooms.get(data.roomCode) : undefined;
    if (!room) return;
    const clientId = data.clientId;
    room.sockets.delete(clientId);
    room.game.removePlayer(clientId);
    data.roomCode = undefined;
    socket.leave(room.code);
    if (room.game.players.length === 0) {
      this.rooms.delete(room.code);
    } else {
      this.broadcast(room);
    }
  }

  broadcast(room: Room): void {
    room.broadcast(this.io);
  }

  private reapEmptyRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (
        room.sockets.size === 0 &&
        room.emptySince &&
        now - room.emptySince > EMPTY_ROOM_TTL_MS
      ) {
        this.rooms.delete(code);
      }
    }
  }
}
