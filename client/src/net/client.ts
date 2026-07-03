import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@cambio/shared";

// Persistent identity so refreshes / reconnects rejoin the same seat.
function getClientId(): string {
  const KEY = "cambio_client_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
      `c_${Math.random().toString(36).slice(2)}${Date.now()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export const clientId = getClientId();

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  `${location.protocol}//${location.hostname}:3001`;

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: ClientSocket = io(SERVER_URL, {
  auth: { clientId },
  autoConnect: true,
  transports: ["websocket", "polling"],
});

/** Promise wrapper around an emit-with-ack. */
export function emit<T = void>(
  event: keyof ClientToServerEvents,
  payload?: unknown
): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const cb = (res: Ack<T>) => resolve(res);
    if (payload === undefined) {
      (socket.emit as (e: string, cb: unknown) => void)(event, cb);
    } else {
      (socket.emit as (e: string, p: unknown, cb: unknown) => void)(
        event,
        payload,
        cb
      );
    }
  });
}
