import { describe, expect, it } from "vitest";
import {
    type GameState,
    type PlayerId,
    PlayerRank,
    RoundPhase,
} from "../../../lib/game/types";
import {
    applyRoundScores,
    assignRoundRanks,
    getMatchWinner,
    isGameOver,
} from "../../../lib/game/scoring";

function makeFinishedRoundState(
    finishOrder: PlayerId[],
    scores: [number, number, number, number] = [0, 0, 0, 0],
): GameState {
    return {
        scores,
        roundNumber: 1,
        matchFinished: false,
        previousRanks: null,
        phase: RoundPhase.Play,
        hands: [[], [], [], []],
        activePlayerId: 0,
        revolutionActive: false,
        finishOrder,
        finishedPlayers: [...finishOrder],
        trick: { topPlay: null, topPlayerId: null, currentPattern: null, passedPlayerIds: [] },
        tradeState: null,
    };
}

describe("assignRoundRanks", () => {
    it("maps finish order to Tycoon/Rich/Poor/Beggar", () => {
        const ranks = assignRoundRanks([2, 0, 3, 1]);
        expect(ranks[2]).toBe(PlayerRank.Tycoon);
        expect(ranks[0]).toBe(PlayerRank.Rich);
        expect(ranks[3]).toBe(PlayerRank.Poor);
        expect(ranks[1]).toBe(PlayerRank.Beggar);
    });
});

describe("applyRoundScores", () => {
    it("adds correct points per finish position", () => {
        const state = makeFinishedRoundState([0, 1, 2, 3]);
        const result = applyRoundScores(state);
        expect(result.scores).toEqual([30, 20, 10, 0]);
    });

    it("accumulates across rounds", () => {
        // finish: 3=Tycoon(+30), 2=Rich(+20), 1=Poor(+10), 0=Beggar(+0)
        const state = makeFinishedRoundState([3, 2, 1, 0], [30, 20, 10, 0]);
        const result = applyRoundScores(state);
        expect(result.scores).toEqual([30, 30, 30, 30]);
    });

    it("sets previousRanks", () => {
        const state = makeFinishedRoundState([1, 0, 3, 2]);
        const result = applyRoundScores(state);
        expect(result.previousRanks![1]).toBe(PlayerRank.Tycoon);
        expect(result.previousRanks![0]).toBe(PlayerRank.Rich);
        expect(result.previousRanks![3]).toBe(PlayerRank.Poor);
        expect(result.previousRanks![2]).toBe(PlayerRank.Beggar);
    });
});

describe("getMatchWinner", () => {
    it("returns player with highest score", () => {
        expect(getMatchWinner([10, 50, 30, 40])).toBe(1);
    });

    it("tie-breaks to lowest player ID", () => {
        expect(getMatchWinner([60, 60, 30, 40])).toBe(0);
    });
});

describe("isGameOver", () => {
    it("returns true when matchFinished", () => {
        const state = makeFinishedRoundState([0, 1, 2, 3]);
        expect(isGameOver({ ...state, matchFinished: true })).toBe(true);
    });

    it("returns true when roundNumber exceeds total", () => {
        const state = makeFinishedRoundState([0, 1, 2, 3]);
        expect(isGameOver({ ...state, roundNumber: 4 })).toBe(true);
    });

    it("returns false during active match", () => {
        const state = makeFinishedRoundState([0, 1, 2, 3]);
        expect(isGameOver({ ...state, roundNumber: 2 })).toBe(false);
    });
});
