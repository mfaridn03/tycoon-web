import { describe, expect, it } from "vitest";
import { SUIT_META, cardLabel, rankLabel } from "../../../components/cards/suit-metadata";
import type { Suit } from "../../../lib/game/types";

describe("SUIT_META", () => {
  it("has correct label for each suit", () => {
    expect(SUIT_META.H.label).toBe("Hearts");
    expect(SUIT_META.D.label).toBe("Diamonds");
    expect(SUIT_META.C.label).toBe("Clubs");
    expect(SUIT_META.S.label).toBe("Spades");
  });

  it("H and D are red", () => {
    expect(SUIT_META.H.colorName).toBe("red");
    expect(SUIT_META.D.colorName).toBe("red");
  });

  it("C and S are black", () => {
    expect(SUIT_META.C.colorName).toBe("black");
    expect(SUIT_META.S.colorName).toBe("black");
  });

  it("has a non-empty hex value for each suit", () => {
    const suits: Suit[] = ["H", "D", "C", "S"];
    for (const suit of suits) {
      expect(SUIT_META[suit].hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("red and black suits have different hex values", () => {
    expect(SUIT_META.H.hex).toBe(SUIT_META.D.hex);
    expect(SUIT_META.C.hex).toBe(SUIT_META.S.hex);
    expect(SUIT_META.H.hex).not.toBe(SUIT_META.C.hex);
  });
});

describe("cardLabel", () => {
  it("expands face card ranks to full names", () => {
    expect(cardLabel("Q", "H")).toBe("Queen of Hearts");
    expect(cardLabel("K", "S")).toBe("King of Spades");
    expect(cardLabel("J", "D")).toBe("Jack of Diamonds");
    expect(cardLabel("A", "C")).toBe("Ace of Clubs");
  });

  it("uses numeric string for number cards", () => {
    expect(cardLabel("7", "H")).toBe("7 of Hearts");
    expect(cardLabel("10", "S")).toBe("10 of Spades");
    expect(cardLabel("2", "D")).toBe("2 of Diamonds");
  });
});

describe("rankLabel", () => {
  it("maps A to Ace", () => expect(rankLabel("A")).toBe("Ace"));
  it("maps J to Jack", () => expect(rankLabel("J")).toBe("Jack"));
  it("maps Q to Queen", () => expect(rankLabel("Q")).toBe("Queen"));
  it("maps K to King", () => expect(rankLabel("K")).toBe("King"));
  it("passes through numeric ranks unchanged", () => {
    expect(rankLabel("3")).toBe("3");
    expect(rankLabel("10")).toBe("10");
  });
});
