import { getRankOrder } from "./constants";
import { type GameState, type PlayerId, PlayPattern } from "./types";
import { getLegalPlays } from "./validation";

const SUIT_ORDER = { D: 0, C: 1, H: 2, S: 3 } as const;

/** Lowest play first: shorter patterns before longer; then rank; then suit. */
function sortPlaysLowestFirst(
    plays: Card[][],
    rankOrder: ReturnType<typeof getRankOrder>,
): Card[][] {
    return [...plays].sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length;
        const ra = rankOrder[a[0]!.rank] - rankOrder[b[0]!.rank];
        if (ra !== 0) return ra;
        return SUIT_ORDER[a[0]!.suit] - SUIT_ORDER[b[0]!.suit];
    });
}

export type BotPlayChoice =
    | { type: "play"; cards: Card[] }
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
    const legal = getLegalPlays(state, playerId);
    const rankOrder = getRankOrder(state.revolutionActive);

    if (state.trick.topPlay !== null) {
        if (legal.length === 0) return { type: "pass" };
        return {
            type: "play",
            cards: sortPlaysLowestFirst(legal, rankOrder)[0]!,
        };
    }

    const rev = legal.filter((c) => c.length === 4);
    if (rev.length > 0) {
        return {
            type: "play",
            cards: sortPlaysLowestFirst(rev, rankOrder)[0]!,
        };
    }

    const availablePatterns = (
        [PlayPattern.One, PlayPattern.Two, PlayPattern.Three] as const
    ).filter((p) => legal.some((c) => c.length === p + 1));

    if (availablePatterns.length > 0) {
        const pick =
            availablePatterns[
                Math.floor(random() * availablePatterns.length)
            ]!;
        const size = pick + 1;
        const subset = legal.filter((c) => c.length === size);
        return {
            type: "play",
            cards: sortPlaysLowestFirst(subset, rankOrder)[0]!,
        };
    }

    if (legal.length === 0) {
        return { type: "pass" };
    }

    return {
        type: "play",
        cards: sortPlaysLowestFirst(legal, rankOrder)[0]!,
    };
}
