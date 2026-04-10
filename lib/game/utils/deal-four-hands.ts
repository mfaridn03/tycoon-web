import type { Card } from "../core/types";
import { sortPlayerHand } from "./sort-player-hand";

/** Split 52 cards into four 13-card hands; first hand sorted for the human player. */
export function dealFourHands(deck: Card[]): Card[][] {
  return [
    sortPlayerHand(deck.slice(0, 13)),
    deck.slice(13, 26),
    deck.slice(26, 39),
    deck.slice(39, 52),
  ];
}
