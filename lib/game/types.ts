export type Suit = "D" | "C" | "H" | "S";
export type Rank = "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" | "2";
// TODO: joker implementation

export interface Comparable<T> {
    higherThan(other: T, rankOrder?: RankOrder): boolean;
}

export type RankOrder = Readonly<Record<Rank, number>>;

export const DEFAULT_RANK_SEQUENCE: readonly Rank[] = [
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
    "2",
];

export function createRankOrder(rankSequence: readonly Rank[] = DEFAULT_RANK_SEQUENCE): RankOrder {
    if (rankSequence.length !== DEFAULT_RANK_SEQUENCE.length) {
        throw new Error("Rank order must include every rank exactly once.");
    }

    const rankOrder = {} as Record<Rank, number>;

    rankSequence.forEach((rank, index) => {
        rankOrder[rank] = index;
    });

    if (Object.keys(rankOrder).length !== DEFAULT_RANK_SEQUENCE.length) {
        throw new Error("Rank order must include every rank exactly once.");
    }

    return Object.freeze(rankOrder);
}

// rank order stuff will be moved to game engine once it's built
// and change depending on game state
export const DEFAULT_RANK_ORDER = createRankOrder();

let activeRankOrder: RankOrder = DEFAULT_RANK_ORDER;

export function getActiveRankOrder(): RankOrder {
    return activeRankOrder;
}

/** Call when game state changes (e.g. revolution). Drives `>` on Card and default `higherThan`. */
export function setActiveRankOrder(order: RankOrder): void {
    activeRankOrder = order;
}

function isHigherRank(rank: Rank, otherRank: Rank, rankOrder?: RankOrder) {
    const order = rankOrder ?? getActiveRankOrder();
    return order[rank] > order[otherRank];
}

export enum PlayType {
    One,
    Two,
    Three,
    EightStop, // for any plays containing only 8
    Revolution, // 4 of the same Rank, overrides EightStop if four 8s
    // Joker, // any Joker plays (TODO: implement later)
    // ThreeSpade // specifically only when 3S is played against unpaired Joker
}
export class Play implements Comparable<Play> {
    public readonly cards: Card[];
    public readonly type: PlayType;

    // play validity checking should be done before class creation
    constructor(cards: Card[]) {
        this.cards = [...cards];
        
        // so at this point `cards` is a valid play, so we can do this easily
        if (cards[0].rank === "8") this.type = PlayType.EightStop;
        else {
            switch(cards.length) {
                case 1:
                    this.type = PlayType.One;
                    break;
                
                case 2:
                    this.type = PlayType.Two;
                    break;

                case 3:
                    this.type = PlayType.Three;
                    break;

                case 4:
                    this.type = PlayType.Revolution;
                    break;
                
                default:
                    // shouldn't be possible to reach this
                    console.log(`How did we get here? Play() cards.length=${cards.length}`);
                    throw new Error(`Invalid card length at Play constructor: ${cards.length}`);
            }
        }
    }

    higherThan(other: Play, rankOrder?: RankOrder) {
        if (this.type !== other.type) return false;
        return this.cards[0].higherThan(other.cards[0], rankOrder);
    }
}

export type Hand = Card[];

// Relational ops (`>`, `<`, …) use numeric coercion: `valueOf` / `Symbol.toPrimitive` with hint `number`.
// Same rank ⇒ equal strength for `>` (both `a > b` and `b > a` false). Suits ignored for order.
// `===` / `==` are still reference equality for two Card instances; use `equals()` for value equality.
export class Card implements Comparable<Card> {
    public readonly rank: Rank;
    public readonly suit: Suit;

    constructor(rank: Rank, suit: Suit) {
        this.rank = rank;
        this.suit = suit;
        Object.freeze(this);
    }

    valueOf(): number {
        return getActiveRankOrder()[this.rank];
    }

    [Symbol.toPrimitive](hint: "default" | "string" | "number"): string | number {
        if (hint === "number" || hint === "default") {
            return getActiveRankOrder()[this.rank];
        }
        return this.toString();
    }

    toString() {
        return `${this.rank} ${this.suit}`;
    }

    equals(other: Card) {
        return other.rank === this.rank && other.suit === this.suit;
    }

    higherThan(other: Card, rankOrder?: RankOrder) {
        return isHigherRank(this.rank, other.rank, rankOrder);
    }
}
