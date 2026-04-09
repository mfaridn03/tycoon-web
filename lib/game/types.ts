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

/** Call when game state changes (e.g. revolution). Drives `>` on Card/Play and default `higherThan`. */
export function setActiveRankOrder(order: RankOrder): void {
    activeRankOrder = order;
}

function isHigherRank(rank: Rank, otherRank: Rank, rankOrder?: RankOrder) {
    const order = rankOrder ?? getActiveRankOrder();
    return order[rank] > order[otherRank];
}

/** Card count / shape of the play (single, pair, triple, four-of-a-kind). */
export enum PlayPattern {
    One,
    Two,
    Three,
    Four,
}

/** Special rules triggered by the play; composable (e.g. four 8s = EightStop + Revolution). */
export enum PlayEffect {
    /** Play uses only 8s (any count). */
    EightStop,
    /** Four of the same rank — revolution. */
    Revolution,
    // Joker, // TODO: joker plays
    // ThreeSpade // TODO: 3S vs Joker edge case
}

// Relational ops on Play use first card’s rank strength (all cards share rank). Ignores pattern/effects.
// `higherThan` requires same `PlayPattern` — use that when legality matters, not raw `>`.
export class Play implements Comparable<Play> {
    public readonly cards: Card[];
    public readonly pattern: PlayPattern;
    /** Frozen; use `.has()` for effect checks. */
    public readonly effects: ReadonlySet<PlayEffect>;

    // play validity checking should be done before class creation
    constructor(cards: Card[]) {
        this.cards = [...cards];
        this.pattern = this.patternFromCardCount(cards.length);
        const effectSet = this.computePlayEffects(cards);
        
        Object.freeze(effectSet);
        this.effects = effectSet;
    }

    valueOf(): number {
        return this.cards[0].valueOf();
    }

    [Symbol.toPrimitive](hint: "default" | "string" | "number"): string | number {
        if (hint === "number" || hint === "default") {
            return this.cards[0].valueOf();
        }
        return this.cards.map((c) => c.toString()).join(" ");
    }

    higherThan(other: Play, rankOrder?: RankOrder) {
        if (this.pattern !== other.pattern) return false;
        return this.cards[0].higherThan(other.cards[0], rankOrder);
    }

    private patternFromCardCount(length: number): PlayPattern {
        switch (length) {
            case 1:
                return PlayPattern.One;
            case 2:
                return PlayPattern.Two;
            case 3:
                return PlayPattern.Three;
            case 4:
                return PlayPattern.Four;
            default:
                throw new Error(`Invalid card length at Play constructor: ${length}`);
        }
    }

    private computePlayEffects(cards: Card[]): Set<PlayEffect> {
        const effects = new Set<PlayEffect>();
        if (cards.length > 0 && cards.every((c) => c.rank === "8")) {
            effects.add(PlayEffect.EightStop);
        }
        if (cards.length === 4) {
            effects.add(PlayEffect.Revolution);
        }
        return effects;
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
