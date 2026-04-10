import type { Rank, Suit } from "../../lib/game/types";

export interface SuitMeta {
  label: string;
  symbol: string;
  colorName: "red" | "black";
  hex: string;
}

export const SUIT_META: Record<Suit, SuitMeta> = {
  H: { label: "Hearts", symbol: "♥", colorName: "red", hex: "#dc2626" },
  D: { label: "Diamonds", symbol: "♦", colorName: "red", hex: "#dc2626" },
  C: { label: "Clubs", symbol: "♣", colorName: "black", hex: "#1a1a1a" },
  S: { label: "Spades", symbol: "♠", colorName: "black", hex: "#1a1a1a" },
};

/**
 * SVG path data for each suit, defined in a 100×100 coordinate space.
 * Scale with `transform="translate(x, y) scale(size / 100)"` when embedding.
 */
export const SUIT_PATHS: Record<Suit, string> = {
  H: "M50 85 C50 85 4 54 4 29 C4 14 15 4 27 4 C35 4 43 9 50 17 C57 9 65 4 73 4 C85 4 96 14 96 29 C96 54 50 85 50 85Z",
  D: "M50 4 L96 50 L50 96 L4 50 Z",
  C: "M50 92 L36 69 C21 69 8 57 8 42 C8 27 20 16 34 18 C30 11 33 4 41 4 C49 4 52 12 50 19 C48 12 51 4 59 4 C67 4 70 11 66 18 C80 16 92 27 92 42 C92 57 79 69 64 69 Z",
  S: "M50 4 C50 4 4 35 4 61 C4 76 17 81 33 69 C30 79 30 92 30 92 L70 92 C70 92 70 79 67 69 C83 81 96 76 96 61 C96 35 50 4 50 4Z",
};

const RANK_LABELS: Partial<Record<Rank, string>> = {
  A: "Ace",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank] ?? rank;
}

export function cardLabel(rank: Rank, suit: Suit): string {
  return `${rankLabel(rank)} of ${SUIT_META[suit].label}`;
}
