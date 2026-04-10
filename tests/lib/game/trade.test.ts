import { describe, expect, it } from "vitest";
import {
    Card,
    type GameState,
    type PlayerId,
    PlayerRank,
    RoundPhase,
} from "../../../lib/game/types";
import { applyTrade, startTradePhase } from "../../../lib/game/trade";

function makeTradeState(): GameState {
    // Ranks: P0=Tycoon, P1=Rich, P2=Poor, P3=Beggar
    const ranks: Record<PlayerId, PlayerRank> = {
        0: PlayerRank.Tycoon,
        1: PlayerRank.Rich,
        2: PlayerRank.Poor,
        3: PlayerRank.Beggar,
    };

    return {
        scores: [30, 20, 10, 0],
        roundNumber: 2,
        matchFinished: false,
        previousRanks: ranks,
        phase: RoundPhase.Deal,
        hands: [
            // Tycoon (P0)
            [new Card("A", "D"), new Card("K", "H"), new Card("5", "C"), new Card("3", "D")],
            // Rich (P1)
            [new Card("Q", "S"), new Card("J", "D"), new Card("7", "H"), new Card("4", "C")],
            // Poor (P2)
            [new Card("10", "D"), new Card("9", "S"), new Card("6", "H"), new Card("3", "S")],
            // Beggar (P3)
            [new Card("2", "C"), new Card("A", "S"), new Card("8", "D"), new Card("4", "H")],
        ],
        activePlayerId: 0,
        revolutionActive: false,
        finishOrder: [],
        finishedPlayers: [],
        demotedTycoonId: null,
        trick: { topPlay: null, topPlayerId: null, currentPattern: null, passedPlayerIds: [] },
        tradeState: null,
    };
}

describe("buildTradeState", () => {
    it("auto-selects beggar's 2 highest and poor's 1 highest", () => {
        const state = startTradePhase(makeTradeState());
        const ts = state.tradeState!;

        expect(ts.requirements).toHaveLength(2);

        // Beggar (P3) gives 2 highest: 2C, AS (default order: 2 > A)
        const beggarReq = ts.requirements[0];
        expect(beggarReq.giverId).toBe(3);
        expect(beggarReq.receiverId).toBe(0);
        expect(beggarReq.count).toBe(2);
        expect(beggarReq.giverCards).toHaveLength(2);
        expect(beggarReq.giverCards![0].rank).toBe("2");
        expect(beggarReq.giverCards![1].rank).toBe("A");

        // Poor (P2) gives 1 highest: 10D
        const poorReq = ts.requirements[1];
        expect(poorReq.giverId).toBe(2);
        expect(poorReq.receiverId).toBe(1);
        expect(poorReq.count).toBe(1);
        expect(poorReq.giverCards).toHaveLength(1);
        expect(poorReq.giverCards![0].rank).toBe("10");
    });

    it("sets phase to Trade", () => {
        const state = startTradePhase(makeTradeState());
        expect(state.phase).toBe(RoundPhase.Trade);
    });
});

describe("applyTrade", () => {
    it("rejects non-receiver player", () => {
        const state = startTradePhase(makeTradeState());
        const result = applyTrade(state, 3, [new Card("8", "D")]);
        expect(result.ok).toBe(false);
    });

    it("rejects wrong card count", () => {
        const state = startTradePhase(makeTradeState());
        // Tycoon needs to give 2 cards
        const result = applyTrade(state, 0, [new Card("3", "D")]);
        expect(result.ok).toBe(false);
    });

    it("completes partial trade without swapping yet", () => {
        const state = startTradePhase(makeTradeState());
        // Tycoon (P0) picks 2 cards to give
        const result = applyTrade(state, 0, [new Card("5", "C"), new Card("3", "D")]);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.state.phase).toBe(RoundPhase.Trade);
        expect(result.state.tradeState).not.toBeNull();
        expect(result.state.tradeState!.completed).toEqual([true, false]);
    });

    it("completes both trades and swaps simultaneously", () => {
        let state = startTradePhase(makeTradeState());

        // Tycoon gives 5C, 3D for beggar's 2C, AS
        let result = applyTrade(state, 0, [new Card("5", "C"), new Card("3", "D")]);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        state = result.state;

        // Rich gives 4C for poor's 10D
        result = applyTrade(state, 1, [new Card("4", "C")]);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Phase transitions to Play
        expect(result.state.phase).toBe(RoundPhase.Play);
        expect(result.state.tradeState).toBeNull();

        // Beggar leads (P3)
        expect(result.state.activePlayerId).toBe(3);

        // Verify swaps: Tycoon now has 2C, AS (from beggar) + remaining AD, KH
        const tycoonHand = result.state.hands[0];
        expect(tycoonHand.some((c) => c.rank === "2" && c.suit === "C")).toBe(true);
        expect(tycoonHand.some((c) => c.rank === "A" && c.suit === "S")).toBe(true);
        expect(tycoonHand.some((c) => c.rank === "5" && c.suit === "C")).toBe(false);
        expect(tycoonHand.some((c) => c.rank === "3" && c.suit === "D")).toBe(false);

        // Beggar now has 5C, 3D (from tycoon) + remaining 8D, 4H
        const beggarHand = result.state.hands[3];
        expect(beggarHand.some((c) => c.rank === "5" && c.suit === "C")).toBe(true);
        expect(beggarHand.some((c) => c.rank === "3" && c.suit === "D")).toBe(true);
        expect(beggarHand.some((c) => c.rank === "2" && c.suit === "C")).toBe(false);
        expect(beggarHand.some((c) => c.rank === "A" && c.suit === "S")).toBe(false);
    });
});
