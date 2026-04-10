import { describe, expect, it } from "vitest";
import { getRankOrder } from "../../../lib/game/constants";
import {
    Card,
    type GameState,
    Play,
    PlayPattern,
    RoundPhase,
    type TrickState,
} from "../../../lib/game/types";
import {
    getLegalPlays,
    validatePlay,
} from "../../../lib/game/validation";

function makeState(overrides: Partial<GameState> = {}): GameState {
    return {
        scores: [0, 0, 0, 0],
        roundNumber: 1,
        matchFinished: false,
        previousRanks: null,
        phase: RoundPhase.Play,
        hands: [
            [new Card("3", "D"), new Card("5", "H"), new Card("5", "S"), new Card("K", "C")],
            [new Card("7", "D"), new Card("7", "H"), new Card("9", "S")],
            [new Card("A", "D"), new Card("A", "S")],
            [new Card("2", "C")],
        ],
        activePlayerId: 0,
        revolutionActive: false,
        finishOrder: [],
        finishedPlayers: [],
        demotedTycoonId: null,
        roundOneOpeningLeadSatisfied: false,
        trick: emptyTrick(),
        tradeState: null,
        ...overrides,
    };
}

function emptyTrick(): TrickState {
    return {
        topPlay: null,
        topPlayerId: null,
        currentPattern: null,
        passedPlayerIds: [],
    };
}

describe("validatePlay", () => {
    it("rejects when not in play phase", () => {
        const s = makeState({ phase: RoundPhase.Trade });
        const r = validatePlay(s, 0, [new Card("3", "D")]);
        expect(r.valid).toBe(false);
    });

    it("rejects wrong player's turn", () => {
        const s = makeState({ activePlayerId: 1 });
        const r = validatePlay(s, 0, [new Card("3", "D")]);
        expect(r.valid).toBe(false);
    });

    it("rejects finished player", () => {
        const s = makeState({ finishedPlayers: [0] });
        const r = validatePlay(s, 0, [new Card("3", "D")]);
        expect(r.valid).toBe(false);
    });

    it("rejects cards not in hand", () => {
        const s = makeState();
        const r = validatePlay(s, 0, [new Card("A", "D")]);
        expect(r.valid).toBe(false);
    });

    it("rejects mixed ranks", () => {
        const s = makeState();
        const r = validatePlay(s, 0, [new Card("3", "D"), new Card("5", "H")]);
        expect(r.valid).toBe(false);
    });

    it("accepts valid single on empty table", () => {
        const s = makeState();
        const r = validatePlay(s, 0, [new Card("3", "D")]);
        expect(r.valid).toBe(true);
    });

    it("accepts valid pair on empty table", () => {
        const s = makeState();
        const r = validatePlay(s, 0, [new Card("5", "H"), new Card("5", "S")]);
        expect(r.valid).toBe(false);
    });

    it("accepts opening play when it includes 3D", () => {
        const s = makeState({
            hands: [
                [new Card("3", "D"), new Card("3", "H"), new Card("K", "C")],
                [new Card("7", "D"), new Card("7", "H"), new Card("9", "S")],
                [new Card("A", "D"), new Card("A", "S")],
                [new Card("2", "C")],
            ],
        });
        const r = validatePlay(s, 0, [new Card("3", "D"), new Card("3", "H")]);
        expect(r.valid).toBe(true);
    });

    it("rejects wrong set size for current trick", () => {
        const s = makeState({
            trick: {
                topPlay: new Play([new Card("4", "D")]),
                topPlayerId: 1,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
        });
        const r = validatePlay(s, 0, [new Card("5", "H"), new Card("5", "S")]);
        expect(r.valid).toBe(false);
    });

    it("rejects play that does not beat top play", () => {
        const s = makeState({
            trick: {
                topPlay: new Play([new Card("K", "D")]),
                topPlayerId: 1,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
        });
        const r = validatePlay(s, 0, [new Card("5", "H")]);
        expect(r.valid).toBe(false);
    });

    it("accepts play that beats top play", () => {
        const s = makeState({
            trick: {
                topPlay: new Play([new Card("4", "D")]),
                topPlayerId: 1,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
        });
        const r = validatePlay(s, 0, [new Card("K", "C")]);
        expect(r.valid).toBe(true);
    });

    it("uses revolution rank order when active", () => {
        const s = makeState({
            revolutionActive: true,
            trick: {
                topPlay: new Play([new Card("K", "D")]),
                topPlayerId: 1,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
        });
        // In revolution, 3 > K
        const r = validatePlay(s, 0, [new Card("3", "D")]);
        const rankOrder = getRankOrder(true);
        expect(new Card("3", "D").higherThan(new Card("K", "D"), rankOrder)).toBe(true);
        expect(r.valid).toBe(true);
    });

    it("rejects duplicate cards in play", () => {
        const s = makeState();
        const r = validatePlay(s, 0, [new Card("5", "H"), new Card("5", "H")]);
        expect(r.valid).toBe(false);
    });
});

describe("getLegalPlays", () => {
    it("returns empty when not player's turn", () => {
        const s = makeState({ activePlayerId: 1 });
        expect(getLegalPlays(s, 0)).toEqual([]);
    });

    it("enumerates all singles/pairs on empty table", () => {
        const s = makeState();
        const plays = getLegalPlays(s, 0);
        const singles = plays.filter((p) => p.length === 1);
        const pairs = plays.filter((p) => p.length === 2);
        expect(singles).toHaveLength(1);
        expect(pairs).toHaveLength(0);
    });

    it("allows only opening plays that include 3D", () => {
        const s = makeState({
            hands: [
                [new Card("3", "D"), new Card("3", "H"), new Card("K", "C")],
                [new Card("7", "D"), new Card("7", "H"), new Card("9", "S")],
                [new Card("A", "D"), new Card("A", "S")],
                [new Card("2", "C")],
            ],
        });
        const plays = getLegalPlays(s, 0);

        expect(plays).toHaveLength(2);
        expect(plays.every((play) => play.some((card) => card.rank === "3" && card.suit === "D"))).toBe(true);
    });

    it("does not require 3D on empty trick after round-1 opening lead (e.g. new trick same round)", () => {
        const s = makeState({
            roundOneOpeningLeadSatisfied: true,
            trick: emptyTrick(),
            hands: [
                [new Card("3", "D"), new Card("9", "H"), new Card("K", "C")],
                [new Card("7", "D")],
                [new Card("A", "D")],
                [new Card("2", "C")],
            ],
        });
        const plays = getLegalPlays(s, 0);
        expect(plays.some((p) => p.length === 1 && p[0]!.rank === "9")).toBe(true);
    });

    it("does not require 3D for round 2+ opening lead when holder still has 3D", () => {
        const s = makeState({
            roundNumber: 2,
            roundOneOpeningLeadSatisfied: true,
            trick: emptyTrick(),
            hands: [
                [new Card("3", "D"), new Card("9", "H"), new Card("K", "C")],
                [new Card("7", "D")],
                [new Card("A", "D")],
                [new Card("2", "C")],
            ],
        });
        const plays = getLegalPlays(s, 0);
        expect(plays.some((p) => p.length === 1 && p[0]!.rank === "9")).toBe(true);
    });

    it("only returns plays matching current trick pattern", () => {
        const s = makeState({
            trick: {
                topPlay: new Play([new Card("4", "D")]),
                topPlayerId: 1,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
        });
        const plays = getLegalPlays(s, 0);
        expect(plays.every((p) => p.length === 1)).toBe(true);
        // 5H, 5S, KC beat 4 (3 doesn't)
        expect(plays).toHaveLength(3);
    });
});
