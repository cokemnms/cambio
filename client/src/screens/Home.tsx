import { useEffect, useState } from "react";
import type { Game } from "../App";

export function Home({ game }: { game: Game }) {
  const [name, setName] = useState(
    () => localStorage.getItem("cambio_name") ?? ""
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Prefill room code from a shared link (?room=ABCD).
  useEffect(() => {
    const url = new URL(location.href);
    const r = url.searchParams.get("room");
    if (r) setCode(r.toUpperCase());
  }, []);

  const saveName = () => localStorage.setItem("cambio_name", name.trim());

  const create = async () => {
    if (!name.trim()) return;
    saveName();
    setBusy(true);
    await game.actions.createRoom(name.trim());
    setBusy(false);
  };

  const join = async () => {
    if (!name.trim() || code.trim().length < 4) return;
    saveName();
    setBusy(true);
    await game.actions.joinRoom(code.trim(), name.trim());
    setBusy(false);
  };

  return (
    <div className="screen home">
      <div className="brand">
        <div className="brand-logo">🃏</div>
        <h1>Cambio</h1>
        <p className="tagline">Lowest hand wins. Trust your memory.</p>
      </div>

      <div className="card-panel">
        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            maxLength={16}
            placeholder="e.g. Alex"
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </label>

        <button
          className="btn btn-primary"
          disabled={busy || !name.trim()}
          onClick={create}
        >
          Create a room
        </button>

        <div className="divider"><span>or join</span></div>

        <label className="field">
          <span>Room code</span>
          <input
            value={code}
            maxLength={4}
            placeholder="ABCD"
            className="code-input"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </label>
        <button
          className="btn"
          disabled={busy || !name.trim() || code.trim().length < 4}
          onClick={join}
        >
          Join room
        </button>
      </div>
    </div>
  );
}
