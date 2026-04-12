import type { Suit } from "@/lib/game/types";
import { SUIT_META } from "./suit-metadata";

interface SuitIconProps {
  suit: Suit;
  /** Font size in pixels. Defaults to 16. */
  size?: number;
  className?: string;
}

export function SuitIcon({ suit, size = 16, className }: SuitIconProps) {
  const { hex, label, symbol } = SUIT_META[suit];
  return (
    <span
      className={className}
      aria-label={label}
      style={{ color: hex, fontSize: size, lineHeight: 1 }}
    >
      {symbol}
    </span>
  );
}
