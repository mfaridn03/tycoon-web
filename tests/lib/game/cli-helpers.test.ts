import { describe, expect, it } from "vitest";
import {
    Card,
    type GameState,
    Play,
    type PlayerId,
    PlayerRank,
} from "../../../lib/game/types";
import { DEFAULT_RANK_ORDER } from "../../../lib/game/types";
import { REVERSED_RANK_ORDER } from "../../../lib/game/constants";
import {
    buildPlayOptions,
    canPass,
    formatCard,
    formatCards,
    formatEvent,
    formatScores,
    formatTrickHistoryEntry,
    playerLabel,
    selectLowestCards,
    sortCards,
} from "../../../lib/game/cli-helpers";

// ---------------------------------------------------------------------------
// Card formatting
// ---------------------------------------------------------------------------

describe("formatCard", () => {
    it("formats single card as compact token", () => {
        expect(formatCard(new Card("3", "D"))).toBe("3D");
        expect(formatCard(new Card("10", "S"))).toBe("10S");
        expect(formatCard(new Card("K", "H"))).toBe("KH");
    });
});

describe("formatCards", () => {
    it("joins multiple cards with spaces", () => {
        const cards = [new Card("3", "D"), new Card("3", "C"), new Card("3", "S")];
        expect(formatCards(cards)).toBe("3D 3C 3S");
    });

    it("handles empty array", () => {
        expect(formatCards([])).toBe("");
    });
});

// ---------------------------------------------------------------------------
// Player labels
// ---------------------------------------------------------------------------

describe("playerLabel", () => {
    it("maps 0-3 to Player X and B-D", () => {
        expect(playerLabel(0)).toBe("Player X");
        expect(playerLabel(1)).toBe("Player B");
        expect(playerLabel(2)).toBe("Player C");
        expect(playerLabel(3)).toBe("Player D");
    });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe("sortCards", () => {
    it("sorts by normal rank order (3 lowest)", () => {
        const cards = [new Card("A", "D"), new Card("3", "S"), new Card("K", "H")];
        const sorted = sortCards(cards, DEFAULT_RANK_ORDER);
        expect(sorted.map(formatCard)).toEqual(["3S", "KH", "AD"]);
    });

    it("sorts by revolution rank order (2 lowest)", () => {
        const cards = [new Card("3", "D"), new Card("2", "S"), new Card("K", "H")];
        const sorted = sortCards(cards, REVERSED_RANK_ORDER);
        expect(sorted.map(formatCard)).toEqual(["2S", "KH", "3D"]);
    });
});

// ---------------------------------------------------------------------------
// selectLowestCards (trade helper)
// ---------------------------------------------------------------------------

describe("selectLowestCards", () => {
    const hand = [
        new Card("A", "D"),
        new Card("3", "S"),
        new Card("K", "H"),
        new Card("5", "C"),
        new Card("7", "D"),
    ];

    it("picks lowest 1 card in normal order", () => {
        const result = selectLowestCards(hand, 1, false);
        expect(result).toHaveLength(1);
        expect(formatCard(result[0])).toBe("3S");
    });

    it("picks lowest 2 cards in normal order", () => {
        const result = selectLowestCards(hand, 2, false);
        expect(result).toHaveLength(2);
        expect(result.map(formatCard)).toEqual(["3S", "5C"]);
    });

    it("picks lowest under revolution (2 is weakest)", () => {
        const hand2 = [
            new Card("2", "D"),
            new Card("A", "S"),
            new Card("3", "H"),
        ];
        const result = selectLowestCards(hand2, 1, true);
        expect(formatCard(result[0])).toBe("2D");
    });
});

// ---------------------------------------------------------------------------
// buildPlayOptions
// ---------------------------------------------------------------------------

describe("buildPlayOptions", () => {
    it("numbers options starting at 1, sorted by size then rank", () => {
        const plays: Card[][] = [
            [new Card("K", "H")],
            [new Card("5", "D")],
            [new Card("5", "C"), new Card("5", "D")],
        ];
        const options = buildPlayOptions(plays, DEFAULT_RANK_ORDER);
        expect(options).toHaveLength(3);
        expect(options[0].index).toBe(1);
        expect(options[0].label).toBe("5D");
        expect(options[1].index).toBe(2);
        expect(options[1].label).toBe("KH");
        expect(options[2].index).toBe(3);
        expect(options[2].label).toBe("5C 5D");
    });

    it("returns empty array when no legal plays", () => {
        const options = buildPlayOptions([], DEFAULT_RANK_ORDER);
        expect(options).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// canPass
// ---------------------------------------------------------------------------

describe("canPass", () => {
    const baseTrick = {
        topPlay: null,
        topPlayerId: null,
        currentPattern: null,
        passedPlayerIds: [],
    };

    it("returns false when no topPlay (new trick)", () => {
        expect(canPass({ trick: baseTrick } as unknown as GameState)).toBe(false);
    });

    it("returns true when topPlay exists", () => {
        const trick = {
            ...baseTrick,
            topPlay: new Play([new Card("5", "D")]),
            topPlayerId: 0 as PlayerId,
        };
        expect(canPass({ trick } as unknown as GameState)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Trick history formatting
// ---------------------------------------------------------------------------

describe("formatTrickHistoryEntry", () => {
    it("formats played cards and marks the current top play", () => {
        const msg = formatTrickHistoryEntry(
            {
                type: "play",
                playerId: 3,
                cards: [new Card("3", "D"), new Card("3", "H")],
            },
            true,
        );

        expect(msg).toBe("Player D played: 3D 3H <");
    });

    it("formats passes", () => {
        const msg = formatTrickHistoryEntry({
            type: "pass",
            playerId: 1,
        });

        expect(msg).toBe("Player B passed.");
    });
});

// ---------------------------------------------------------------------------
// Event formatting
// ---------------------------------------------------------------------------

describe("formatEvent", () => {
    it("formats eightStop", () => {
        expect(formatEvent({ type: "eightStop", playerId: 1 })).toBe("Eight stopped!");
    });

    it("formats revolution", () => {
        const msg = formatEvent({ type: "revolution" });
        expect(msg).toContain("REVOLUTION");
    });

    it("formats counterRevolution", () => {
        const msg = formatEvent({ type: "counterRevolution" });
        expect(msg).toContain("COUNTER-REVOLUTION");
    });

    it("formats playerFinished", () => {
        const msg = formatEvent({ type: "playerFinished", playerId: 2, position: 1 });
        expect(msg).toContain("Player C");
        expect(msg).toContain("position 1");
    });

    it("formats roundFinished with all ranks", () => {
        const ranks = {
            0: PlayerRank.Tycoon,
            1: PlayerRank.Rich,
            2: PlayerRank.Poor,
            3: PlayerRank.Beggar,
        } as Record<PlayerId, PlayerRank>;
        const msg = formatEvent({ type: "roundFinished", ranks })!;
        expect(msg).toContain("Round Finished");
        expect(msg).toContain("Player X: Tycoon");
        expect(msg).toContain("Player D: Beggar");
    });

    it("formats matchFinished", () => {
        const msg = formatEvent({ type: "matchFinished", winner: 0 });
        expect(msg).toContain("Player X wins");
    });

    it("formats trickEnded", () => {
        const msg = formatEvent({ type: "trickEnded", winner: 3 });
        expect(msg).toContain("Player D");
    });
});

// ---------------------------------------------------------------------------
// Score formatting
// ---------------------------------------------------------------------------

describe("formatScores", () => {
    it("formats all four scores", () => {
        const msg = formatScores([30, 20, 10, 0]);
        expect(msg).toContain("Player X: 30");
        expect(msg).toContain("Player D: 0");
    });
});
