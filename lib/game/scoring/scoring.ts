import { SCORE_TABLE, TOTAL_ROUNDS } from "../core/constants";
import { type GameState, type PlayerId, PlayerRank } from "../core/types";

const RANK_BY_POSITION: readonly PlayerRank[] = [
    PlayerRank.Tycoon,
    PlayerRank.Rich,
    PlayerRank.Poor,
    PlayerRank.Beggar,
];

export function assignRoundRanks(
    finishOrder: PlayerId[],
): Record<PlayerId, PlayerRank> {
    const ranks = {} as Record<PlayerId, PlayerRank>;
    for (let i = 0; i < finishOrder.length; i++) {
        ranks[finishOrder[i]] = RANK_BY_POSITION[i];
    }
    return ranks;
}

export function applyRoundScores(state: GameState): GameState {
    const ranks = assignRoundRanks(state.finishOrder);
    const scores = [...state.scores] as [number, number, number, number];

    for (const pid of state.finishOrder) {
        scores[pid] += SCORE_TABLE[ranks[pid]];
    }

    return { ...state, scores, previousRanks: ranks };
}

export function isGameOver(state: GameState): boolean {
    return state.matchFinished || state.roundNumber > TOTAL_ROUNDS;
}

/**
 * Tie-break: highest single-round score across match, then lowest PlayerId.
 * `roundScores` = per-round score arrays if tracked, but we simplify:
 * since scores accumulate and ranks are fixed per-round, we use total score
 * then fall back to lowest id.
 */
export function getMatchWinner(
    scores: [number, number, number, number],
): PlayerId {
    let maxScore = -1;
    let winner: PlayerId = 0;
    for (let i = 0; i < 4; i++) {
        if (scores[i] > maxScore) {
            maxScore = scores[i];
            winner = i as PlayerId;
        }
    }
    return winner;
}
