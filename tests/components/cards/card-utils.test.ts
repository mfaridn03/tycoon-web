import { describe, expect, it } from "vitest";
import { drawRandomCard } from "../../../components/cards/card-utils";
import { SUITS } from "../../../lib/game/constants";
import { DEFAULT_RANK_SEQUENCE } from "../../../lib/game/types";

describe("drawRandomCard", () => {
  it("returns a card with a valid rank", () => {
    const card = drawRandomCard();
    expect(DEFAULT_RANK_SEQUENCE).toContain(card.rank);
  });

  it("returns a card with a valid suit", () => {
    const card = drawRandomCard();
    expect(SUITS).toContain(card.suit);
  });

  it("returns different cards over multiple draws (probabilistic)", () => {
    const draws = new Set(
      Array.from({ length: 20 }, () => {
        const c = drawRandomCard();
        return `${c.rank}:${c.suit}`;
      }),
    );
    // With 52 possible cards and 20 draws, getting all identical is astronomically unlikely
    expect(draws.size).toBeGreaterThan(1);
  });

  it("drawn cards are always from the 52-card deck", () => {
    for (let i = 0; i < 50; i++) {
      const card = drawRandomCard();
      expect(DEFAULT_RANK_SEQUENCE).toContain(card.rank);
      expect(SUITS).toContain(card.suit);
    }
  });
});
