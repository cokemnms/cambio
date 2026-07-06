import { PartySocket } from "partysocket";
import type { ClientMsg, GameStateView, ServerMsg } from "@cambio/shared";

// Party host. In dev, `partykit dev` serves on :1999 on the same machine the
// browser reached us from — so derive it from the current hostname (works over
// LAN too). Override with VITE_PARTY_HOST for a deployed backend.
const PARTY_HOST =
  (import.meta.env.VITE_PARTY_HOST as string | undefined) ??
  `${location.hostname}:1999`;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomRoomCode(len = 4): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    ""
  );
}

// Persistent identity so a refresh / reconnect reclaims the same seat.
function persistentClientId(): string {
  const KEY = "cambio_client_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
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

  readonly clientId = persistentClientId();
  private socket: PartySocket | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  create(name: string): void {
    this.connect(randomRoomCode(), name);
  }

  join(code: string, name: string): void {
    this.connect(code.toUpperCase(), name);
  }

  private connect(room: string, name: string): void {
    this.disconnect();
    this.socket = new PartySocket({
      host: PARTY_HOST,
      room,
      id: this.clientId,
      query: { name },
    });
    this.socket.addEventListener("open", () => (this.connected = true));
    this.socket.addEventListener("close", () => (this.connected = false));
    this.socket.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data as string) as ServerMsg;
      if (msg.t === "state") {
        this.view = msg.view;
      } else if (msg.t === "notice") {
        this.flash(msg.message, msg.kind ?? "info");
      } else if (msg.t === "closed") {
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
