import { afterEach, describe, expect, it } from "vitest";

import {
    Card,
    createRankOrder,
    DEFAULT_RANK_ORDER,
    Play,
    PlayEffect,
    PlayPattern,
    setActiveRankOrder,
} from "../../../lib/game/types";

describe("Card", () => {
    afterEach(() => {
        setActiveRankOrder(DEFAULT_RANK_ORDER);
    });

    it("compares cards with active rank order by default", () => {
        const three = new Card("3", "D");
        const ace = new Card("A", "S");

        expect(ace > three).toBe(true);

        const reversedOrder = createRankOrder([
            "2",
            "A",
            "K",
            "Q",
            "J",
            "10",
            "9",
            "8",
            "7",
            "6",
            "5",
            "4",
            "3",
        ]);

        setActiveRankOrder(reversedOrder);

        expect(ace > three).toBe(false);
        expect(three > ace).toBe(true);
    });

    it("accepts explicit rank order in higherThan", () => {
        const five = new Card("5", "H");
        const king = new Card("K", "C");
        const customOrder = createRankOrder([
            "K",
            "Q",
            "J",
            "10",
            "9",
            "8",
            "7",
            "6",
            "5",
            "4",
            "3",
            "2",
            "A",
        ]);

        expect(five.higherThan(king)).toBe(false);
        expect(five.higherThan(king, customOrder)).toBe(true);
    });

    it("uses value equality instead of reference equality", () => {
        const first = new Card("10", "S");
        const sameValue = new Card("10", "S");
        const differentSuit = new Card("10", "H");

        expect(first.equals(sameValue)).toBe(true);
        expect(first.equals(differentSuit)).toBe(false);
        expect(first === sameValue).toBe(false);
    });

    it("returns string and primitive representations", () => {
        const card = new Card("Q", "H");

        expect(card.toString()).toBe("Q H");
        expect(String(card)).toBe("Q H");
        expect(Number(card)).toBe(DEFAULT_RANK_ORDER.Q);
    });
});

describe("Play", () => {
    afterEach(() => {
        setActiveRankOrder(DEFAULT_RANK_ORDER);
    });

    it("assigns pattern from card count", () => {
        expect(new Play([new Card("4", "D")]).pattern).toBe(PlayPattern.One);
        expect(new Play([new Card("4", "D"), new Card("4", "S")]).pattern).toBe(PlayPattern.Two);
        expect(new Play([new Card("4", "D"), new Card("4", "S"), new Card("4", "H")]).pattern).toBe(
            PlayPattern.Three,
        );
        expect(
            new Play([
                new Card("4", "D"),
                new Card("4", "S"),
                new Card("4", "H"),
                new Card("4", "C"),
            ]).pattern,
        ).toBe(PlayPattern.Four);
    });

    it("adds Revolution for any four-of-a-kind", () => {
        const fourFours = new Play([
            new Card("4", "D"),
            new Card("4", "S"),
            new Card("4", "H"),
            new Card("4", "C"),
        ]);
        expect(fourFours.effects.has(PlayEffect.Revolution)).toBe(true);
        expect(fourFours.effects.has(PlayEffect.EightStop)).toBe(false);
    });

    it("adds EightStop for plays that are only 8s", () => {
        expect(new Play([new Card("8", "D")]).effects.has(PlayEffect.EightStop)).toBe(true);
        expect(
            new Play([new Card("8", "D"), new Card("8", "S")]).effects.has(PlayEffect.EightStop),
        ).toBe(true);
        expect(
            new Play([
                new Card("8", "D"),
                new Card("8", "S"),
                new Card("8", "H"),
                new Card("8", "C"),
            ]).effects.has(PlayEffect.EightStop),
        ).toBe(true);
    });

    it("four 8s get both EightStop and Revolution", () => {
        const fourEights = new Play([
            new Card("8", "D"),
            new Card("8", "S"),
            new Card("8", "H"),
            new Card("8", "C"),
        ]);
        expect(fourEights.pattern).toBe(PlayPattern.Four);
        expect(fourEights.effects.has(PlayEffect.EightStop)).toBe(true);
        expect(fourEights.effects.has(PlayEffect.Revolution)).toBe(true);
        expect(fourEights.effects.size).toBe(2);
    });

    it("compares plays only when patterns match", () => {
        const lowSingle = new Play([new Card("5", "D")]);
        const highSingle = new Play([new Card("9", "S")]);
        const pair = new Play([new Card("9", "D"), new Card("9", "H")]);

        expect(highSingle.higherThan(lowSingle)).toBe(true);
        expect(lowSingle.higherThan(highSingle)).toBe(false);
        expect(pair.higherThan(lowSingle)).toBe(false);
    });

    it("uses first card for numeric and string coercion", () => {
        const play = new Play([new Card("J", "D"), new Card("J", "S")]);

        expect(Number(play)).toBe(DEFAULT_RANK_ORDER.J);
        expect(String(play)).toBe("J D J S");
    });

    it("throws for unsupported play lengths", () => {
        expect(() => {
            new Play([
                new Card("3", "D"),
                new Card("3", "S"),
                new Card("3", "H"),
                new Card("3", "C"),
                new Card("4", "D"),
            ]);
        }).toThrow("Invalid card length at Play constructor: 5");
    });
});
