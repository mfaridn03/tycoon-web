import { createDeck } from "@/lib/game/core/constants";
import type { Card } from "@/lib/game/core/types";

export function drawRandomCard(): Card {
  const deck = createDeck();
  return deck[Math.floor(Math.random() * deck.length)];
}
