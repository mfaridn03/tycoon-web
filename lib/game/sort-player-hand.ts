import type { Card, Suit } from "@/lib/game/types";
import { DEFAULT_RANK_ORDER } from "@/lib/game/types";

const SUIT_ORDER: Record<Suit, number> = { D: 0, C: 1, H: 2, S: 3 };

/** Sort by rank (game/CLI order), then suit tie-break. */
export function sortPlayerHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const rankDiff = DEFAULT_RANK_ORDER[a.rank] - DEFAULT_RANK_ORDER[b.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
}
