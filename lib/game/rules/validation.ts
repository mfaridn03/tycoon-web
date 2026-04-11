import { getRankOrder } from "../core/constants";
import {
    type Card,
    type GameState,
    type LegalPlay,
    Play,
    type PlayerId,
    PlayEffect,
    PlayPattern,
    type Rank,
    RoundPhase,
    type ValidateResult,
} from "../core/types";

function cardInHand(hand: Card[], card: Card): boolean {
    return hand.some((c) => c.equals(card));
}

function isThreeOfDiamonds(card: Card): boolean {
    return card.rank === "3" && card.suit === "D";
}

function openingLeadMustIncludeThreeOfDiamonds(
    state: GameState,
    playerId: PlayerId,
): boolean {
    return (
        state.roundNumber === 1 &&
        !state.roundOneOpeningLeadSatisfied &&
        state.trick.topPlay === null &&
        state.hands[playerId].some(isThreeOfDiamonds)
    );
}

/**
 * Check all non-joker cards share same rank, and if wildcardRank given,
 * that non-joker cards match it.
 */
function allSameRankWithJokers(cards: Card[], wildcardRank?: Rank): boolean {
    if (cards.length === 0) return false;
    const nonJokers = cards.filter((c) => !c.isJoker());

    if (nonJokers.length === 0) {
        // All jokers — valid for any rank or as themselves
        return true;
    }

    const rank = nonJokers[0].rank;
    if (!nonJokers.every((c) => c.rank === rank)) return false;

    // If wildcardRank given, non-joker rank must match
    if (wildcardRank && wildcardRank !== rank) return false;

    return true;
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
    wildcardRank?: Rank,
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

    const hasJokers = cards.some((c) => c.isJoker());
    const nonJokers = cards.filter((c) => !c.isJoker());

    // Determine effective wildcardRank
    let effectiveWildcard = wildcardRank;
    if (hasJokers && nonJokers.length > 0 && !effectiveWildcard) {
        // Jokers mixed with normal cards — infer wildcardRank from normal cards
        effectiveWildcard = nonJokers[0].rank;
    }

    if (!allSameRankWithJokers(cards, effectiveWildcard)) {
        return { valid: false, reason: "All cards must be the same rank" };
    }

    const pattern = patternFromLength(cards.length);
    if (pattern === null) {
        return { valid: false, reason: "Invalid number of cards" };
    }

    // 3♦ opening-lead rule: joker wildcarding as 3 does NOT satisfy it
    if (
        openingLeadMustIncludeThreeOfDiamonds(state, playerId) &&
        !cards.some(isThreeOfDiamonds)
    ) {
        return {
            valid: false,
            reason: "Opening play must include 3D",
        };
    }

    const { trick } = state;

    if (trick.currentPattern !== null && trick.currentPattern !== pattern) {
        return {
            valid: false,
            reason: `Must play ${trick.currentPattern + 1} card(s) to match current trick`,
        };
    }

    if (trick.topPlay !== null) {
        const play = new Play(cards, effectiveWildcard);
        const rankOrder = getRankOrder(state.revolutionActive);
        if (!play.higherThan(trick.topPlay, rankOrder)) {
            return { valid: false, reason: "Play does not beat the current top play" };
        }
    }

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
): LegalPlay[] {
    if (state.phase !== RoundPhase.Play) return [];
    if (state.activePlayerId !== playerId) return [];
    if (state.finishedPlayers.includes(playerId)) return [];

    const hand = state.hands[playerId];
    const rankOrder = getRankOrder(state.revolutionActive);
    const { trick } = state;

    // Separate jokers from normal cards
    const jokers = hand.filter((c) => c.isJoker());
    const normalCards = hand.filter((c) => !c.isJoker());

    // Group normal cards by rank
    const rankGroups = new Map<string, Card[]>();
    for (const card of normalCards) {
        const group = rankGroups.get(card.rank) ?? [];
        group.push(card);
        rankGroups.set(card.rank, group);
    }

    const results: LegalPlay[] = [];
    const mustInclude3D = openingLeadMustIncludeThreeOfDiamonds(state, playerId);

    const sizes =
        trick.currentPattern !== null
            ? [trick.currentPattern + 1]
            : [1, 2, 3, 4];

    // --- Normal plays (no jokers) ---
    for (const [, group] of rankGroups) {
        for (const size of sizes) {
            if (group.length < size) continue;

            const combos = combinations(group, size);
            for (const combo of combos) {
                if (mustInclude3D && !combo.some(isThreeOfDiamonds)) continue;

                if (trick.topPlay !== null) {
                    const play = new Play(combo);
                    if (!play.higherThan(trick.topPlay, rankOrder)) continue;
                }
                results.push({ cards: combo });
            }
        }
    }

    // --- Plays using jokers as wildcards with normal cards ---
    if (jokers.length > 0) {
        const jokerCombos = allSubsets(jokers, 1, jokers.length);

        for (const [rank, group] of rankGroups) {
            for (const size of sizes) {
                // Need at least 1 normal card + jokers to fill the rest
                for (const jokerSubset of jokerCombos) {
                    const normalNeeded = size - jokerSubset.length;
                    if (normalNeeded < 1 || normalNeeded > group.length) continue;

                    const normalCombos = combinations(group, normalNeeded);
                    for (const normalCombo of normalCombos) {
                        const combo = [...normalCombo, ...jokerSubset];
                        const wildcardRank = rank as Rank;

                        if (mustInclude3D && !combo.some(isThreeOfDiamonds)) continue;

                        if (trick.topPlay !== null) {
                            const play = new Play(combo, wildcardRank);
                            if (!play.higherThan(trick.topPlay, rankOrder)) continue;
                        }
                        results.push({ cards: combo, wildcardRank });
                    }
                }
            }
        }
    }

    // --- Solo joker plays (as themselves, no wildcard) ---
    for (const joker of jokers) {
        if (!sizes.includes(1)) continue;
        if (mustInclude3D) continue; // Joker alone can't satisfy 3D

        if (trick.topPlay !== null) {
            const play = new Play([joker]);
            if (!play.higherThan(trick.topPlay, rankOrder)) continue;
        }
        results.push({ cards: [joker] });
    }

    // --- Pair of jokers (as themselves) — unbeatable ---
    if (jokers.length === 2 && sizes.includes(2)) {
        if (!mustInclude3D) {
            if (trick.topPlay !== null) {
                const play = new Play(jokers);
                if (play.higherThan(trick.topPlay, rankOrder)) {
                    results.push({ cards: [...jokers] });
                }
            } else {
                results.push({ cards: [...jokers] });
            }
        }
    }

    // --- 3♠ counter: if top play is solo joker, add 3S if in hand ---
    if (
        trick.topPlay !== null &&
        trick.topPlay.effects.has(PlayEffect.Joker) &&
        sizes.includes(1)
    ) {
        const threeSpade = normalCards.find(
            (c) => c.rank === "3" && c.suit === "S",
        );
        if (threeSpade) {
            // Check not already added as normal play
            const alreadyAdded = results.some(
                (r) =>
                    r.cards.length === 1 &&
                    r.cards[0].rank === "3" &&
                    r.cards[0].suit === "S" &&
                    !r.wildcardRank,
            );
            if (!alreadyAdded) {
                results.push({ cards: [threeSpade] });
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

/** All subsets of arr with size between minK and maxK inclusive. */
function allSubsets<T>(arr: T[], minK: number, maxK: number): T[][] {
    const results: T[][] = [];
    for (let k = minK; k <= Math.min(maxK, arr.length); k++) {
        results.push(...combinations(arr, k));
    }
    return results;
}
