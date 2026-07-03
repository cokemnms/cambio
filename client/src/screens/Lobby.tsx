import { useState } from "react";
import type { Game } from "../App";

export function Lobby({ game }: { game: Game }) {
  const { view, youId, actions } = game;
  const [copied, setCopied] = useState(false);
  if (!view) return null;

  const me = view.players.find((p) => p.id === youId);
  const isHost = !!me?.isHost;
  const shareUrl = `${location.origin}${location.pathname}?room=${view.roomCode}`;

  const share = async () => {
    const data = {
      title: "Cambio",
      text: `Join my Cambio game — room ${view.roomCode}`,
      url: shareUrl,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else throw new Error("no share");
    } catch {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="screen lobby">
      <div className="lobby-head">
        <div className="room-code" onClick={share}>
          <span className="room-code-label">Room</span>
          <span className="room-code-value">{view.roomCode}</span>
        </div>
        <button className="btn btn-ghost" onClick={() => actions.leaveRoom()}>
          Leave
        </button>
      </div>

      <button className="btn btn-share" onClick={share}>
        {copied ? "Link copied!" : "📤 Share invite"}
      </button>

      <div className="players-list">
        <h2>Players ({view.players.length})</h2>
        {view.players.map((p) => (
          <div key={p.id} className="player-row">
            <span className="player-dot" data-on={p.connected} />
            <span className="player-name">
              {p.name}
              {p.id === youId && " (you)"}
            </span>
            {p.isHost && <span className="badge">Host</span>}
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          className="btn btn-primary btn-lg"
          disabled={view.players.length < 2}
          onClick={() => actions.startGame()}
        >
          {view.players.length < 2 ? "Waiting for players…" : "Start game"}
        </button>
      ) : (
        <p className="hint">Waiting for the host to start…</p>
      )}
    </div>
  );
}
