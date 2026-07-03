import type { CardView } from "@cambio/shared";

const SUIT_SYMBOL: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

interface CardProps {
  card?: CardView | null;
  /** Force showing the back even if data is present. */
  faceDown?: boolean;
  selectable?: boolean;
  selected?: boolean;
  highlight?: boolean;
  empty?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export function Card({
  card,
  faceDown,
  selectable,
  selected,
  highlight,
  empty,
  size = "md",
  onClick,
}: CardProps) {
  if (empty || card === null) {
    return <div className={`card card-${size} card-empty`} />;
  }

  const faceUp = !!card?.faceUp && !faceDown;
  const red = card?.suit === "hearts" || card?.suit === "diamonds";

  const classes = [
    "card",
    `card-${size}`,
    faceUp ? "card-face" : "card-back",
    red ? "card-red" : "card-black",
    selectable ? "card-selectable" : "",
    selected ? "card-selected" : "",
    highlight ? "card-highlight" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={!selectable && !onClick}
    >
      {faceUp && card ? (
        <>
          <span className="card-rank">{card.rank}</span>
          <span className="card-suit">{SUIT_SYMBOL[card.suit ?? "spades"]}</span>
        </>
      ) : (
        <span className="card-back-emblem">🃏</span>
      )}
    </button>
  );
}
