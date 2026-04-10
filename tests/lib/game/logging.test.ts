import { describe, expect, it } from "vitest";
import {
    formatActionLine,
    formatHandsBlock,
    formatLogEvent,
    formatRoleLines,
    formatTradeLines,
} from "../../../lib/game/logging";
import { Card, PlayerRank } from "../../../lib/game/types";

describe("game logging helpers", () => {
    it("formats hand blocks with player letters and sizes", () => {
        const hands = [
            [new Card("3", "D"), new Card("3", "C")],
            [new Card("8", "H")],
            [],
            [new Card("A", "S")],
        ] as const;

        expect(formatHandsBlock(hands, false)).toEqual([
            "A: 3D 3C (2)",
            "B: 8H (1)",
            "C: (empty) (0)",
            "D: AS (1)",
        ]);
    });

    it("formats round role lines in requested style", () => {
        expect(
            formatRoleLines({
                0: PlayerRank.Tycoon,
                1: PlayerRank.Poor,
                2: PlayerRank.Rich,
                3: PlayerRank.Beggar,
            }),
        ).toEqual([
            "tycoon: A",
            "rich: C",
            "poor: B",
            "beggar: D",
        ]);
    });

    it("formats trade lines in both directions", () => {
        expect(
            formatTradeLines([
                {
                    giverId: 0,
                    receiverId: 3,
                    count: 2,
                    giverCards: [new Card("3", "S"), new Card("4", "H")],
                    receiverCards: [new Card("2", "C"), new Card("A", "C")],
                },
            ]),
        ).toEqual([
            "A -> D: 3S 4H",
            "D -> A: 2C AC",
        ]);
    });

    it("formats play, pass, and events for transcript lines", () => {
        expect(
            formatActionLine({
                type: "play",
                playerId: 1,
                cards: [new Card("7", "D")],
            }),
        ).toBe("Player B played: 7D");
        expect(formatActionLine({ type: "pass", playerId: 2 })).toBe("C: pass");
        expect(formatLogEvent({ type: "eightStop", playerId: 3 })).toBe("Eight stop");
    });
});
