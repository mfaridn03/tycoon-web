import {
    type Card,
    Card as CardClass,
    createRankOrder,
    DEFAULT_RANK_ORDER,
    DEFAULT_RANK_SEQUENCE,
    type PlayerId,
    PlayerRank,
    type Rank,
    type RankOrder,
    type Suit,
} from "./types";

/** Standard playing-card suits (excludes joker pseudo-suits RJ/BJ). */
export const SUITS: readonly Suit[] = ["D", "C", "H", "S"];

/** Standard ranks (excludes JK). */
export const STANDARD_RANKS: readonly Rank[] = DEFAULT_RANK_SEQUENCE.filter(
    (r) => r !== "JK",
);

export const REVERSED_RANK_SEQUENCE: readonly Rank[] = [
    ...DEFAULT_RANK_SEQUENCE,
].reverse() as Rank[];

export const REVERSED_RANK_ORDER: RankOrder = createRankOrder(
    REVERSED_RANK_SEQUENCE,
);

export function getRankOrder(revolutionActive: boolean): RankOrder {
    return revolutionActive ? REVERSED_RANK_ORDER : DEFAULT_RANK_ORDER;
}

/** 54-card deck: 52 standard + 2 jokers. */
export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of STANDARD_RANKS) {
            deck.push(new CardClass(rank, suit));
        }
    }
    // Jokers
    deck.push(new CardClass("JK", "RJ"));
    deck.push(new CardClass("JK", "BJ"));
    return deck;
}

export const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

export const SCORE_TABLE: Record<PlayerRank, number> = {
    [PlayerRank.Tycoon]: 30,
    [PlayerRank.Rich]: 20,
    [PlayerRank.Poor]: 10,
    [PlayerRank.Beggar]: 0,
};

export const TOTAL_ROUNDS = Infinity;
/** Minimum cards per player (54 / 4 = 13r2, so two players get 14). */
export const CARDS_PER_PLAYER = 13;
