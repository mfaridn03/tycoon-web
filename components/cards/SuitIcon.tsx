import type { Suit } from "@/lib/game/types";
import { SUIT_META, SUIT_PATHS } from "./suit-metadata";

interface SuitIconProps {
  suit: Suit;
  /** Rendered width and height in pixels. Defaults to 16. */
  size?: number;
  className?: string;
}

export function SuitIcon({ suit, size = 16, className }: SuitIconProps) {
  const { hex, label } = SUIT_META[suit];
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label={label}
    >
      <path d={SUIT_PATHS[suit]} fill={hex} />
    </svg>
  );
}
