import { getRankOrder } from "../core/constants";
import {
    type Card,
    type GameState,
    type LegalPlay,
    type PlayerId,
    type Rank,
    PlayPattern,
} from "../core/types";
import { getLegalPlays } from "../rules/validation";

const SUIT_ORDER = { D: 0, C: 1, H: 2, S: 3, RJ: 4, BJ: 5 } as const;

/**
 * Filter for Joker plays:
 * - Allow length 1 (itself), 3 (triple), or 4 (revolution).
 * - Allow length 2 ONLY IF it consists of 2 jokers AND is beating a pair of 2s.
 * - Discourage "wasting" a joker for other pairs.
 * - Prevent mimicking a rank with a single joker.
 */
function isPreferredJokerPlay(play: LegalPlay, state: GameState): boolean {
    const hasJoker = play.cards.some((c) => c.isJoker());
    if (!hasJoker) return true;
    const count = play.cards.length;
    // Reject if used as a wildcard for a single card (mimicking)
    if (count === 1 && play.wildcardRank) return false;

    // Reject pairs except two jokers beating a pair of 2s
    if (count === 2) {
        const allJokers = play.cards.every((c) => c.isJoker());
        const beatingTwos =
            state.trick.topPlay !== null &&
            state.trick.topPlay.cards.length === 2 &&
            state.trick.topPlay.effectiveRank === "2";
        return allJokers && beatingTwos;
    }

    // Joker only allowed as single (1), triple (3), or revolution (4)
    return count === 1 || count === 3 || count === 4;
}

/** Lowest play first: shorter patterns before longer; then rank; then suit. */
function sortPlaysLowestFirst(
    plays: LegalPlay[],
    rankOrder: ReturnType<typeof getRankOrder>,
): LegalPlay[] {
    return [...plays].sort((a, b) => {
        if (a.cards.length !== b.cards.length) return a.cards.length - b.cards.length;
        // Use effective rank for comparison
        const rankA = a.wildcardRank ?? a.cards[0]!.rank;
        const rankB = b.wildcardRank ?? b.cards[0]!.rank;
        const ra = rankOrder[rankA] - rankOrder[rankB];
        if (ra !== 0) return ra;
        return (SUIT_ORDER[a.cards[0]!.suit as keyof typeof SUIT_ORDER] ?? 0) -
            (SUIT_ORDER[b.cards[0]!.suit as keyof typeof SUIT_ORDER] ?? 0);
    });
}

export type BotPlayChoice =
    | { type: "play"; cards: Card[]; wildcardRank?: Rank }
    | { type: "pass" };

/**
 * Bots: lowest legal play that beats current trick, else pass.
 * New trick: lowest revolution (four of a kind) if any; else random among
 * single/pair/triple patterns that exist, then lowest play in that pattern.
 */
export function chooseBotPlay(
    state: GameState,
    playerId: PlayerId,
    random: () => number = Math.random,
): BotPlayChoice {
    const allLegal = getLegalPlays(state, playerId);
    const legal = allLegal.filter((p) => isPreferredJokerPlay(p, state));

    const rankOrder = getRankOrder(state.revolutionActive);

    if (state.trick.topPlay !== null) {
        if (legal.length === 0) return { type: "pass" };
        const sorted = sortPlaysLowestFirst(legal, rankOrder);
        const pick = sorted[0]!;
        return {
            type: "play",
            cards: pick.cards,
            wildcardRank: pick.wildcardRank,
        };
    }

    const rev = legal.filter((c) => c.cards.length === 4);
    if (rev.length > 0) {
        const sorted = sortPlaysLowestFirst(rev, rankOrder);
        const pick = sorted[0]!;
        return {
            type: "play",
            cards: pick.cards,
            wildcardRank: pick.wildcardRank,
        };
    }

    const availablePatterns = (
        [PlayPattern.One, PlayPattern.Two, PlayPattern.Three] as const
    ).filter((p) => legal.some((c) => c.cards.length === p + 1));

    if (availablePatterns.length > 0) {
        const pick =
            availablePatterns[
            Math.floor(random() * availablePatterns.length)
            ]!;
        const size = pick + 1;
        const subset = legal.filter((c) => c.cards.length === size);
        const sorted = sortPlaysLowestFirst(subset, rankOrder);
        const chosen = sorted[0]!;
        return {
            type: "play",
            cards: chosen.cards,
            wildcardRank: chosen.wildcardRank,
        };
    }

    if (legal.length === 0) {
        return { type: "pass" };
    }

    const sorted = sortPlaysLowestFirst(legal, rankOrder);
    const pick = sorted[0]!;
    return {
        type: "play",
        cards: pick.cards,
        wildcardRank: pick.wildcardRank,
    };
}
