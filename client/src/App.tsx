import { useGame } from "./useGame";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { Table } from "./screens/Table";
import { Notices } from "./components/Notices";

export function App() {
  const game = useGame();
  const { view } = game;

  let screen;
  if (!view) {
    screen = <Home game={game} />;
  } else if (view.phase === "lobby") {
    screen = <Lobby game={game} />;
  } else {
    screen = <Table game={game} />;
  }

  return (
    <div className="app">
      {!game.connected && (
        <div className="conn-banner">Reconnecting…</div>
      )}
      {screen}
      <Notices notices={game.notices} />
    </div>
  );
}

export type Game = ReturnType<typeof useGame>;
