import { createDeck } from "../../lib/game/constants";
import type { Card } from "../../lib/game/types";

export function drawRandomCard(): Card {
  const deck = createDeck();
  return deck[Math.floor(Math.random() * deck.length)];
}
