import { describe, expect, it } from "vitest";
import {
    buildBotTradeAction,
    getNextPendingTrade,
    isHumanTradeTurn,
} from "@/lib/game/trade/helpers";
import { startTradePhase } from "@/lib/game/trade/trade";
import {
    Card,
    type GameState,
    type PlayerId,
    PlayerRank,
    RoundPhase,
} from "@/lib/game/core/types";

function makeTradeState(): GameState {
    const ranks: Record<PlayerId, PlayerRank> = {
        0: PlayerRank.Tycoon,
        1: PlayerRank.Rich,
        2: PlayerRank.Poor,
        3: PlayerRank.Beggar,
    };

    return startTradePhase({
        scores: [30, 20, 10, 0],
        roundNumber: 2,
        matchFinished: false,
        previousRanks: ranks,
        phase: RoundPhase.Deal,
        hands: [
            [new Card("A", "D"), new Card("K", "H"), new Card("5", "C"), new Card("3", "D")],
            [new Card("Q", "S"), new Card("J", "D"), new Card("7", "H"), new Card("4", "C")],
            [new Card("10", "D"), new Card("9", "S"), new Card("6", "H"), new Card("3", "S")],
            [new Card("2", "C"), new Card("A", "S"), new Card("8", "D"), new Card("4", "H")],
        ],
        activePlayerId: 0,
        revolutionActive: false,
        finishOrder: [],
        finishedPlayers: [],
        demotedTycoonId: null,
        roundOneOpeningLeadSatisfied: true,
        trick: { topPlay: null, topPlayerId: null, currentPattern: null, passedPlayerIds: [] },
        tradeState: null,
    });
}

describe("getNextPendingTrade", () => {
    it("returns first incomplete requirement", () => {
        const state = makeTradeState();
        const pending = getNextPendingTrade(state);
        expect(pending).not.toBeNull();
        expect(pending!.index).toBe(0);
        expect(pending!.requirement.receiverId).toBe(0);
    });

    it("returns null when no tradeState", () => {
        const state = makeTradeState();
        const result = getNextPendingTrade({ ...state, tradeState: null });
        expect(result).toBeNull();
    });

    it("skips completed requirements", () => {
        const state = makeTradeState();
        state.tradeState!.completed[0] = true;
        const pending = getNextPendingTrade(state);
        expect(pending).not.toBeNull();
        expect(pending!.index).toBe(1);
        expect(pending!.requirement.receiverId).toBe(1);
    });

    it("returns null when all completed", () => {
        const state = makeTradeState();
        state.tradeState!.completed[0] = true;
        state.tradeState!.completed[1] = true;
        expect(getNextPendingTrade(state)).toBeNull();
    });
});

describe("isHumanTradeTurn", () => {
    it("returns true when human is next receiver", () => {
        const state = makeTradeState();
        expect(isHumanTradeTurn(state, 0)).toBe(true);
    });

    it("returns false when bot is next receiver", () => {
        const state = makeTradeState();
        state.tradeState!.completed[0] = true;
        expect(isHumanTradeTurn(state, 0)).toBe(false);
    });
});

describe("buildBotTradeAction", () => {
    it("builds completeTrade with lowest cards from receiver hand", () => {
        const state = makeTradeState();
        state.tradeState!.completed[0] = true;
        const pending = getNextPendingTrade(state)!;
        const action = buildBotTradeAction(state, pending);
        expect(action.type).toBe("completeTrade");
        expect((action as { playerId: PlayerId }).playerId).toBe(1);
        const cards = (action as { cards: Card[] }).cards;
        expect(cards).toHaveLength(1);
        expect(cards[0].rank).toBe("4");
    });
});
