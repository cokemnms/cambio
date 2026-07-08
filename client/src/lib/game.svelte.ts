import { PartySocket } from "partysocket";
import type { ClientMsg, GameStateView, ServerMsg } from "@cambio/shared";
import { seatKey } from "@cambio/shared";

// Party host. In dev, `partykit dev` serves on :1999 on the same machine the
// browser reached us from — so derive it from the current hostname (works over
// LAN too). Override with VITE_PARTY_HOST for a deployed backend.
// Dev: the party runs on :1999 on the same machine (works over LAN too).
// Prod: the party is co-hosted with the SPA, so use the page's own origin.
const PARTY_HOST =
  (import.meta.env.VITE_PARTY_HOST as string | undefined) ??
  (import.meta.env.DEV ? `${location.hostname}:1999` : location.host);

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// `getRandomValues` works in insecure contexts (http over LAN); `randomUUID`
// does NOT. Build ids from bytes so the app runs on a phone over plain http.
function randomBytes(len: number): Uint8Array {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint8Array(len));
  return Uint8Array.from({ length: len }, () => Math.floor(Math.random() * 256));
}

function randomRoomCode(len = 4): string {
  return Array.from(randomBytes(len), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

interface Notice {
  message: string;
  kind: "info" | "warn" | "error";
}

/**
 * Singleton game client. `$state` fields are reactive across the whole app:
 * components that read `game.view` re-render whenever a server push updates it.
 */
class GameClient {
  view = $state<GameStateView | null>(null);
  connected = $state(false);
  notice = $state<Notice | null>(null);

  /** Name-based seat key; the server keys the seat by the same value. */
  clientId = $state("");
  private socket: PartySocket | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  create(name: string): void {
    this.connect(randomRoomCode(), name);
  }

  join(code: string, name: string): void {
    this.connect(code.toUpperCase(), name);
  }

  /** Reconnect to the room we were in (e.g. after a page reload). */
  resume(): void {
    if (this.socket) return;
    if (new URLSearchParams(location.search).get("room")) return; // a share link wins
    const room = localStorage.getItem("cambio_room");
    const name = localStorage.getItem("cambio_name");
    if (room && name) this.connect(room, name);
  }

  private connect(room: string, name: string): void {
    this.disconnect();
    this.clientId = seatKey(name);
    localStorage.setItem("cambio_room", room);
    localStorage.setItem("cambio_name", name);
    const token = localStorage.getItem("cambio_tok_" + room) ?? "";
    this.socket = new PartySocket({
      host: PARTY_HOST,
      room,
      query: token ? { name, token } : { name },
    });
    this.socket.addEventListener("open", () => (this.connected = true));
    this.socket.addEventListener("close", () => (this.connected = false));
    this.socket.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data as string) as ServerMsg;
      if (msg.t === "state") {
        this.view = msg.view;
      } else if (msg.t === "welcome") {
        localStorage.setItem("cambio_tok_" + room, msg.token);
      } else if (msg.t === "notice") {
        this.flash(msg.message, msg.kind ?? "info");
      } else if (msg.t === "closed") {
        localStorage.removeItem("cambio_room");
        this.flash(msg.reason, "warn");
        this.disconnect();
      }
    });
  }

  send(msg: ClientMsg): void {
    this.socket?.send(JSON.stringify(msg));
  }

  leave(): void {
    this.send({ t: "leave" });
    this.disconnect();
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    this.view = null;
  }

  /** Convenience: the viewer's own player, if in a game. */
  get me() {
    return this.view?.players.find((p) => p.id === this.clientId) ?? null;
  }

  get isHost(): boolean {
    return this.me?.isHost ?? false;
  }

  private flash(message: string, kind: Notice["kind"]): void {
    this.notice = { message, kind };
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.notice = null), 3000);
  }
}

export const game = new GameClient();
