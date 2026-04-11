import { describe, expect, it } from "vitest";
import {
    createDeck,
    getRankOrder,
    REVERSED_RANK_ORDER,
    SUITS,
} from "../../../lib/game/constants";
import {
    DEFAULT_RANK_ORDER,
    DEFAULT_RANK_SEQUENCE,
} from "../../../lib/game/types";

describe("createDeck", () => {
    it("produces 54 unique cards", () => {
        const deck = createDeck();
        expect(deck).toHaveLength(54);

        const keys = new Set(deck.map((c) => `${c.rank}:${c.suit}`));
        expect(keys.size).toBe(54);
    });

    it("contains every rank/suit combination", () => {
        const deck = createDeck();
        for (const suit of ["D", "C", "H", "S"]) {
            for (const rank of DEFAULT_RANK_SEQUENCE.filter(r => r !== "JK")) {
                expect(
                    deck.some((c) => c.rank === rank && c.suit === suit),
                ).toBe(true);
            }
        }
        expect(deck.some((c) => c.rank === "JK" && c.suit === "RJ")).toBe(true);
        expect(deck.some((c) => c.rank === "JK" && c.suit === "BJ")).toBe(true);
    });
});

describe("REVERSED_RANK_ORDER", () => {
    it("ranks 2 lowest and 3 highest", () => {
        expect(REVERSED_RANK_ORDER["2"]).toBeLessThan(
            REVERSED_RANK_ORDER["3"],
        );
        expect(REVERSED_RANK_ORDER["3"]).toBe(13);
        expect(REVERSED_RANK_ORDER["JK"]).toBe(0);
    });

    it("inverts default order for all ranks", () => {
        for (const rank of DEFAULT_RANK_SEQUENCE) {
            expect(
                DEFAULT_RANK_ORDER[rank] + REVERSED_RANK_ORDER[rank],
            ).toBe(13);
        }
    });
});

describe("getRankOrder", () => {
    it("returns default when revolution is false", () => {
        expect(getRankOrder(false)).toBe(DEFAULT_RANK_ORDER);
    });

    it("returns reversed when revolution is true", () => {
        expect(getRankOrder(true)).toBe(REVERSED_RANK_ORDER);
    });
});
