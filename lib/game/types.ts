export type Suit = "D" | "C" | "H" | "S";
export type Rank = "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" | "2";
// TODO: joker implementation

export enum PlayType {
    One,
    Two,
    Three,
    EightStop, // for any plays containing only 8
    Revolution, // 4 of the same Rank, overrides EightStop if four 8s
    // Joker, // any Joker plays (TODO: implement later)
    // ThreeSpade // specifically only when 3S is played against unpaired Joker
}
export class Play {
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

    higherThan(other: Play) {
        // todo
    }
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

    toString() {
        return `${this.rank} ${this.suit}`;
    }

    equals(other: Card) {
        return other.rank === this.rank && other.suit === this.suit;
    }
}
