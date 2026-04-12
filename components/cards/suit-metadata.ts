import type { Rank, Suit } from "@/lib/game/core/types";

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
  RJ: { label: "Red Joker", symbol: "★", colorName: "red", hex: "#dc2626" },
  BJ: { label: "Black Joker", symbol: "★", colorName: "black", hex: "#1a1a1a" },
};


const RANK_LABELS: Partial<Record<Rank, string>> = {
  A: "Ace",
  J: "Jack",
  Q: "Queen",
  K: "King",
  JK: "Joker",
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank] ?? rank;
}

export function cardLabel(rank: Rank, suit: Suit): string {
  if (rank === "JK") {
    return suit === "RJ" ? "Red Joker" : "Black Joker";
  }
  return `${rankLabel(rank)} of ${SUIT_META[suit].label}`;
}
