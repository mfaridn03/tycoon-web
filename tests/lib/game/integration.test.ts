import { describe, expect, it } from "vitest";
import {
    Card,
    type GameState,
    PlayerRank,
    RoundPhase,
    type ShuffleFn,
} from "../../../lib/game/types";
import {
    createInitialGameState,
    dispatch,
    startRound,
} from "../../../lib/game/engine";
import { getLegalPlays } from "../../../lib/game/validation";
import { applyTrade, buildTradeState } from "../../../lib/game/trade";

function playLowestOrPass(state: GameState): GameState {
    const pid = state.activePlayerId;
    const legal = getLegalPlays(state, pid);

    if (legal.length === 0) {
        const r = dispatch(state, { type: "pass", playerId: pid });
        if (!r.ok) throw new Error(`Pass failed: ${r.reason}`);
        return r.state;
    }

    const sorted = [...legal].sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length;
        return a[0].valueOf() - b[0].valueOf();
    });

    const r = dispatch(state, { type: "play", playerId: pid, cards: sorted[0] });
    if (!r.ok) throw new Error(`Play failed: ${r.reason}`);
    return r.state;
}

function playRound(state: GameState): GameState {
    let s = state;
    let safety = 0;

    while (s.phase === RoundPhase.Play && safety < 500) {
        s = playLowestOrPass(s);
        safety++;
    }

    if (safety >= 500) throw new Error("Round exceeded max iterations");
    return s;
}

function completeTrades(state: GameState): GameState {
    if (state.phase !== RoundPhase.Trade || !state.tradeState) return state;

    let s = state;

    const numReqs = s.tradeState!.requirements.length;
    for (let i = 0; i < numReqs; i++) {
        if (!s.tradeState) break;
        const req = s.tradeState.requirements[i];
        if (s.tradeState.completed[i]) continue;

        const receiverHand = s.hands[req.receiverId];
        const toGive = [...receiverHand]
            .sort((a, b) => a.valueOf() - b.valueOf())
            .slice(0, req.count);

        const r = applyTrade(s, req.receiverId, toGive);
        if (!r.ok) throw new Error(`Trade failed: ${r.reason}`);
        s = r.state;
    }

    return s;
}

function seededShuffle(seed: number): ShuffleFn {
    return (deck) => {
        const arr = [...deck];
        let s = seed;
        for (let i = arr.length - 1; i > 0; i--) {
            s = (s * 1664525 + 1013904223) & 0x7fffffff;
            const j = s % (i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };
}

describe("single round", () => {
    it("completes round 1 with all players finishing", () => {
        let state = createInitialGameState();
        const r = startRound(state, seededShuffle(42));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        state = r.state;

        expect(state.phase).toBe(RoundPhase.Play);

        state = playRound(state);

        expect(state.finishOrder).toHaveLength(4);
        expect(state.previousRanks).not.toBeNull();
        expect(state.scores.reduce((a, b) => a + b, 0)).toBe(60);
    });
});

describe("full 3-round match", () => {
    it("completes 3 rounds with valid scoring", () => {
        let state = createInitialGameState();

        for (let round = 1; round <= 3; round++) {
            const r = startRound(state, seededShuffle(round * 42));
            expect(r.ok).toBe(true);
            if (!r.ok) throw new Error(r.reason);
            state = r.state;

            if (state.phase === RoundPhase.Trade) {
                state = completeTrades(state);
                expect(state.phase).toBe(RoundPhase.Play);
            }

            state = playRound(state);

            if (round < 3) {
                expect(state.phase).toBe(RoundPhase.Deal);
                expect(state.roundNumber).toBe(round + 1);
            }
        }

        expect(state.matchFinished).toBe(true);

        for (const score of state.scores) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score % 10).toBe(0);
        }

        const total = state.scores.reduce((a, b) => a + b, 0);
        expect(total).toBe(180);
    });

    it("produces all four ranks after each round", () => {
        let state = createInitialGameState();
        const r = startRound(state, seededShuffle(99));
        if (!r.ok) throw new Error(r.reason);
        state = playRound(r.state);

        expect(state.previousRanks).not.toBeNull();
        const rankValues = Object.values(state.previousRanks!);
        expect(rankValues).toContain(PlayerRank.Tycoon);
        expect(rankValues).toContain(PlayerRank.Rich);
        expect(rankValues).toContain(PlayerRank.Poor);
        expect(rankValues).toContain(PlayerRank.Beggar);
    });
});

describe("revolution across rounds", () => {
    it("revolution flag resets between rounds", () => {
        let state = createInitialGameState();
        const r = startRound(state, seededShuffle(1));
        if (!r.ok) throw new Error(r.reason);
        state = { ...r.state, revolutionActive: true };
        state = playRound(state);

        const r2 = startRound(state, seededShuffle(2));
        if (!r2.ok) throw new Error(r2.reason);
        expect(r2.state.revolutionActive).toBe(false);
    });

    it("clears revolution flag when round finishes", () => {
        let state = createInitialGameState();
        const r = startRound(state, seededShuffle(1));
        if (!r.ok) throw new Error(r.reason);
        state = { ...r.state, revolutionActive: true };
        state = playRound(state);
        expect(state.revolutionActive).toBe(false);
    });
});

describe("trade rank order", () => {
    it("beggar highest cards ignore revolution flag (normal order)", () => {
        const state: GameState = {
            ...createInitialGameState(),
            phase: RoundPhase.Trade,
            roundNumber: 2,
            revolutionActive: true,
            previousRanks: {
                0: PlayerRank.Tycoon,
                1: PlayerRank.Rich,
                2: PlayerRank.Poor,
                3: PlayerRank.Beggar,
            },
            hands: [
                [new Card("6", "D")],
                [new Card("7", "D")],
                [new Card("5", "C")],
                [
                    new Card("2", "D"),
                    new Card("2", "C"),
                    new Card("3", "H"),
                    new Card("3", "S"),
                ],
            ],
        };
        const ts = buildTradeState(state);
        const giver = ts.requirements[0].giverCards!;
        expect(giver).toHaveLength(2);
        expect(giver.every((c) => c.rank === "2")).toBe(true);
    });
});
