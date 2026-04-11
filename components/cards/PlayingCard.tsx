import type { Rank, Suit } from "@/lib/game/types";
import { SUIT_META, cardLabel } from "./suit-metadata";
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
const NON_SELECTABLE_STYLE = {
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
} as const;

function CornerIndex({ rank, suit, hex }: { rank: Rank; suit: Suit; hex: string }) {
  if (rank === "JK") {
    return (
      <g>
        <text
          x="5"
          y="16"
          fontSize="14"
          fontWeight="700"
          fill={hex}
          fontFamily="system-ui, -apple-system, sans-serif"
          dominantBaseline="auto"
          style={NON_SELECTABLE_STYLE}
        >
          ★
        </text>
      </g>
    );
  }
  return (
    <g>
      <text
        x="5"
        y="16"
        fontSize="16"
        fontWeight="700"
        fill={hex}
        fontFamily="system-ui, -apple-system, sans-serif"
        dominantBaseline="auto"
        style={NON_SELECTABLE_STYLE}
      >
        {rank}
      </text>
      <text
        x="5"
        y="30"
        fontSize="16"
        fontWeight="700"
        fill={hex}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={NON_SELECTABLE_STYLE}
      >
        {SUIT_META[suit].symbol}
      </text>
    </g>
  );
}

/** SVG children only — no wrapper div, no interaction. Use inside your own <svg>. */
export function CardFaceContent({ rank, suit }: { rank: Rank; suit: Suit }) {
  const { hex } = SUIT_META[suit];

  if (rank === "JK") {
    return (
      <>
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

        <CornerIndex rank={rank} suit={suit} hex={hex} />

        <g transform="rotate(180 40 56)">
          <CornerIndex rank={rank} suit={suit} hex={hex} />
        </g>

        {/* Large star */}
        <text
          x="40"
          y="48"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="32"
          fontWeight="700"
          fill={hex}
          fontFamily="system-ui, -apple-system, sans-serif"
          style={NON_SELECTABLE_STYLE}
        >
          ★
        </text>

        {/* JOKER label */}
        <text
          x="40"
          y="72"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fontWeight="700"
          fill={hex}
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="1"
          style={NON_SELECTABLE_STYLE}
        >
          JOKER
        </text>
      </>
    );
  }

  const { symbol } = SUIT_META[suit];
  const isFace = FACE_RANKS.has(rank);

  return (
    <>
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

      <CornerIndex rank={rank} suit={suit} hex={hex} />

      <g transform="rotate(180 40 56)">
        <CornerIndex rank={rank} suit={suit} hex={hex} />
      </g>

      <text
        x="40"
        y="58"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={isFace ? "30" : "36"}
        fontWeight="700"
        fill={hex}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={NON_SELECTABLE_STYLE}
      >
        {isFace ? `${rank}${symbol}` : symbol}
      </text>
    </>
  );
}

function CardFace({ rank, suit }: { rank: Rank; suit: Suit }) {
  return <CardFaceContent rank={rank} suit={suit} />;
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
    "select-none",
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
        style={{ display: "block", width: "100%", height: "100%", ...NON_SELECTABLE_STYLE }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <CardFace rank={rank} suit={suit} />
      </svg>
    </div>
  );
}
