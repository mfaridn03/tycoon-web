import { getRankOrder } from "./constants";
import {
    type Card,
    type GameState,
    Play,
    type PlayerId,
    PlayPattern,
    RoundPhase,
    type ValidateResult,
} from "./types";

function cardInHand(hand: Card[], card: Card): boolean {
    return hand.some((c) => c.equals(card));
}

function allSameRank(cards: Card[]): boolean {
    if (cards.length === 0) return false;
    const rank = cards[0].rank;
    return cards.every((c) => c.rank === rank);
}

function patternFromLength(len: number): PlayPattern | null {
    switch (len) {
        case 1:
            return PlayPattern.One;
        case 2:
            return PlayPattern.Two;
        case 3:
            return PlayPattern.Three;
        case 4:
            return PlayPattern.Four;
        default:
            return null;
    }
}

// --- Play validation ---

export function validatePlay(
    state: GameState,
    playerId: PlayerId,
    cards: Card[],
): ValidateResult {
    if (state.phase !== RoundPhase.Play) {
        return { valid: false, reason: "Round is not in play phase" };
    }

    if (state.activePlayerId !== playerId) {
        return { valid: false, reason: "Not this player's turn" };
    }

    if (state.finishedPlayers.includes(playerId)) {
        return { valid: false, reason: "Player already finished" };
    }

    if (cards.length === 0) {
        return { valid: false, reason: "Must play at least one card" };
    }

    const hand = state.hands[playerId];
    for (const card of cards) {
        if (!cardInHand(hand, card)) {
            return { valid: false, reason: `Card ${card} not in hand` };
        }
    }

    // Check for duplicates in the played cards
    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            if (cards[i].equals(cards[j])) {
                return {
                    valid: false,
                    reason: `Duplicate card ${cards[i]}`,
                };
            }
        }
    }

    if (!allSameRank(cards)) {
        return { valid: false, reason: "All cards must be the same rank" };
    }

    const pattern = patternFromLength(cards.length);
    if (pattern === null) {
        return { valid: false, reason: "Invalid number of cards" };
    }

    const { trick } = state;

    if (trick.currentPattern !== null && trick.currentPattern !== pattern) {
        return {
            valid: false,
            reason: `Must play ${trick.currentPattern + 1} card(s) to match current trick`,
        };
    }

    if (trick.topPlay !== null) {
        const play = new Play(cards);
        const rankOrder = getRankOrder(state.revolutionActive);
        if (!play.higherThan(trick.topPlay, rankOrder)) {
            return { valid: false, reason: "Play does not beat the current top play" };
        }
    }

    // Extension point: future special-card / joker blocking checks go here

    return { valid: true };
}

// --- Trade validation ---

export function validateTrade(
    state: GameState,
    playerId: PlayerId,
    cards: Card[],
): ValidateResult {
    if (state.phase !== RoundPhase.Trade) {
        return { valid: false, reason: "Not in trade phase" };
    }

    if (!state.tradeState) {
        return { valid: false, reason: "No active trade state" };
    }

    const reqIndex = state.tradeState.requirements.findIndex(
        (r) => r.receiverId === playerId,
    );
    if (reqIndex === -1) {
        return { valid: false, reason: "Player is not a trade receiver" };
    }

    if (state.tradeState.completed[reqIndex]) {
        return { valid: false, reason: "Trade already completed" };
    }

    const req = state.tradeState.requirements[reqIndex];

    if (cards.length !== req.count) {
        return {
            valid: false,
            reason: `Must select exactly ${req.count} card(s) to trade`,
        };
    }

    const hand = state.hands[playerId];
    for (const card of cards) {
        if (!cardInHand(hand, card)) {
            return { valid: false, reason: `Card ${card} not in hand` };
        }
    }

    return { valid: true };
}

// --- Legal plays enumeration ---

export function getLegalPlays(
    state: GameState,
    playerId: PlayerId,
): Card[][] {
    if (state.phase !== RoundPhase.Play) return [];
    if (state.activePlayerId !== playerId) return [];
    if (state.finishedPlayers.includes(playerId)) return [];

    const hand = state.hands[playerId];
    const rankOrder = getRankOrder(state.revolutionActive);
    const { trick } = state;

    const rankGroups = new Map<string, Card[]>();
    for (const card of hand) {
        const group = rankGroups.get(card.rank) ?? [];
        group.push(card);
        rankGroups.set(card.rank, group);
    }

    const results: Card[][] = [];

    for (const [, group] of rankGroups) {
        const sizes =
            trick.currentPattern !== null
                ? [trick.currentPattern + 1]
                : [1, 2, 3, 4];

        for (const size of sizes) {
            if (group.length < size) continue;

            const combos = combinations(group, size);
            for (const combo of combos) {
                if (trick.topPlay !== null) {
                    const play = new Play(combo);
                    if (!play.higherThan(trick.topPlay, rankOrder)) continue;
                }
                results.push(combo);
            }
        }
    }

    return results;
}

function combinations<T>(arr: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (k > arr.length) return [];
    if (k === arr.length) return [arr.slice()];

    const results: T[][] = [];
    for (let i = 0; i <= arr.length - k; i++) {
        const rest = combinations(arr.slice(i + 1), k - 1);
        for (const combo of rest) {
            results.push([arr[i], ...combo]);
        }
    }
    return results;
}
