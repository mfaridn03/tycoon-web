import type { Rank, Suit } from "@/lib/game/types";
import { SUIT_META, SUIT_PATHS, cardLabel } from "./suit-metadata";
import { CardBack } from "./CardBack";

interface PlayingCardProps {
  rank: Rank;
  suit: Suit;
  selected?: boolean;
  faceDown?: boolean;
  disabled?: boolean;
  className?: string;
}

const FACE_RANKS = new Set<Rank>(["J", "Q", "K"]);

function CornerIndex({ rank, suit, hex }: { rank: Rank; suit: Suit; hex: string }) {
  return (
    <g>
      <text
        x="5"
        y="14"
        fontSize="11"
        fontWeight="700"
        fill={hex}
        fontFamily="system-ui, -apple-system, sans-serif"
        dominantBaseline="auto"
      >
        {rank}
      </text>
      {/* Suit icon: 100×100 path scaled to ~10px */}
      <path
        d={SUIT_PATHS[suit]}
        fill={hex}
        transform="translate(4.5 16) scale(0.1)"
      />
    </g>
  );
}

function CardFace({ rank, suit }: { rank: Rank; suit: Suit }) {
  const { hex } = SUIT_META[suit];
  const isFace = FACE_RANKS.has(rank);

  return (
    <>
      {/* Card background */}
      <rect
        x="0.5"
        y="0.5"
        width="79"
        height="111"
        rx="5"
        fill="white"
        stroke="#d4d4d4"
        strokeWidth="1"
      />

      {/* Top-left corner index */}
      <CornerIndex rank={rank} suit={suit} hex={hex} />

      {/* Bottom-right corner index — rotated 180° around card center */}
      <g transform="rotate(180 40 56)">
        <CornerIndex rank={rank} suit={suit} hex={hex} />
      </g>

      {/* Center content */}
      {isFace ? (
        <>
          {/* Large rank letter */}
          <text
            x="40"
            y="62"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="34"
            fontWeight="700"
            fill={hex}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {rank}
          </text>
          {/* Small suit icon below rank letter: ~16px centered */}
          <path
            d={SUIT_PATHS[suit]}
            fill={hex}
            transform="translate(32 72) scale(0.16)"
          />
        </>
      ) : (
        /* Large centered suit icon: ~42px */
        <path
          d={SUIT_PATHS[suit]}
          fill={hex}
          transform="translate(19 35) scale(0.42)"
        />
      )}
    </>
  );
}

export function PlayingCard({
  rank,
  suit,
  selected = false,
  faceDown = false,
  disabled = false,
  className,
}: PlayingCardProps) {
  const label = cardLabel(rank, suit);

  const wrapperClasses = [
    "inline-block",
    "transition-transform duration-150",
    disabled
      ? "opacity-50"
      : selected
        ? "-translate-y-1.5"
        : "hover:-translate-y-1",
    selected ? "ring-2 ring-white rounded-[5px]" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (faceDown) {
    return (
      <div className={wrapperClasses} aria-label={`${label} (face down)`}>
        <CardBack />
      </div>
    );
  }

  return (
    <div
      className={wrapperClasses}
      role="img"
      aria-label={label}
      style={{ lineHeight: 0 }}
    >
      <svg
        viewBox="0 0 80 112"
        style={{ display: "block", width: "100%", height: "100%" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <CardFace rank={rank} suit={suit} />
      </svg>
    </div>
  );
}
