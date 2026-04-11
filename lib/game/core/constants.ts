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

export const SUITS: readonly Suit[] = ["D", "C", "H", "S"];

export const REVERSED_RANK_SEQUENCE: readonly Rank[] = [
    ...DEFAULT_RANK_SEQUENCE,
].reverse() as Rank[];

export const REVERSED_RANK_ORDER: RankOrder = createRankOrder(
    REVERSED_RANK_SEQUENCE,
);

export function getRankOrder(revolutionActive: boolean): RankOrder {
    return revolutionActive ? REVERSED_RANK_ORDER : DEFAULT_RANK_ORDER;
}

export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of DEFAULT_RANK_SEQUENCE) {
            deck.push(new CardClass(rank, suit));
        }
    }
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
export const CARDS_PER_PLAYER = 13;
