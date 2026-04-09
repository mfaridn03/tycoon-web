export type Suit = "D" | "C" | "H" | "S";
export type Rank = "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" | "2";

export enum PlayType {
    One,
    Two,
    Three,
    EightStop, // for any plays containing only 8
    Revolution, // 4 of the same Rank, overrides EightStop if four 8s
    Joker, // any Joker plays (TODO)
    ThreeSpade // specifically only when 3S is played against unpaired Joker
}
export type Hand = Card[];
export class Card {
    public readonly rank: Rank;
    public readonly suit: Suit;

    constructor(rank: Rank, suit: Suit) {
        this.rank = rank;
        this.suit = suit;
        Object.freeze(this);
    }

    public toString() {
        return `${this.rank} ${this.suit}`;
    }

    public equals(other: Card) {
        return other.rank === this.rank && other.suit === this.suit;
    }
}
