import { describe, expect, it } from "vitest";
import {
    Card,
    type GameState,
    Play,
    PlayPattern,
    type PlayerId,
    PlayerRank,
    RoundPhase,
    type ShuffleFn,
} from "../../../lib/game/types";
import {
    createInitialGameState,
    dispatch,
    startRound,
} from "../../../lib/game/engine";

// Deterministic "shuffle" — just returns the deck as-is
const noShuffle: ShuffleFn = (deck) => deck;

// Builds a fixed shuffle that produces known hands
function fixedShuffle(cards: Card[]): ShuffleFn {
    return () => [...cards];
}

// Build a deck where cards are dealt round-robin, so
// player 0 gets indices 0,4,8,...  player 1 gets 1,5,9,... etc.
function buildDeckForHands(
    hands: [Card[], Card[], Card[], Card[]],
): Card[] {
    const deck: Card[] = [];
    for (let i = 0; i < 13; i++) {
        for (let p = 0; p < 4; p++) {
            deck.push(hands[p][i]);
        }
    }
    return deck;
}

describe("createInitialGameState", () => {
    it("returns a fresh state in Deal phase", () => {
        const s = createInitialGameState();
        expect(s.roundNumber).toBe(1);
        expect(s.phase).toBe(RoundPhase.Deal);
        expect(s.scores).toEqual([0, 0, 0, 0]);
        expect(s.matchFinished).toBe(false);
        expect(s.demotedTycoonId).toBeNull();
    });
});

describe("startRound", () => {
    it("deals and finds 3D holder for round 1", () => {
        const s = createInitialGameState();
        const result = startRound(s, noShuffle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.state.phase).toBe(RoundPhase.Play);
        // 3D should be in the active player's hand
        const activeId = result.state.activePlayerId;
        const hand = result.state.hands[activeId];
        expect(hand.some((c) => c.rank === "3" && c.suit === "D")).toBe(true);
    });

    it("each player gets 13 cards", () => {
        const s = createInitialGameState();
        const result = startRound(s, noShuffle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        for (let i = 0; i < 4; i++) {
            const len = result.state.hands[i].length;
            expect(len === 13 || len === 14).toBe(true);
        }
    });
});

describe("applyMove (play cards)", () => {
    function startedRound1(): GameState {
        const s = createInitialGameState();
        const result = startRound(s, noShuffle);
        if (!result.ok) throw new Error(result.reason);
        return result.state;
    }

    it("rejects opening play that does not include 3D", () => {
        const s = startedRound1();
        const activeId = s.activePlayerId;
        const non3DCard = s.hands[activeId].find(
            (card) => !(card.rank === "3" && card.suit === "D"),
        );

        expect(non3DCard).toBeDefined();

        const result = dispatch(s, {
            type: "play",
            playerId: activeId,
            cards: [non3DCard!],
        });
        expect(result.ok).toBe(false);
    });

    it("plays a valid single card", () => {
        const s = startedRound1();
        const activeId = s.activePlayerId;
        const card = new Card("3", "D");
        const initialHandSize = s.hands[activeId].length;

        const result = dispatch(s, { type: "play", playerId: activeId, cards: [card] });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.state.hands[activeId]).toHaveLength(initialHandSize - 1);
        expect(result.state.trick.topPlay).not.toBeNull();
        expect(result.state.trick.currentPattern).toBe(PlayPattern.One);
    });

    it("rejects play from wrong player", () => {
        const s = startedRound1();
        const wrongId = ((s.activePlayerId + 1) % 4) as PlayerId;
        const card = s.hands[wrongId][0];

        const result = dispatch(s, { type: "play", playerId: wrongId, cards: [card] });
        expect(result.ok).toBe(false);
    });
});

describe("applyPass", () => {
    function startedWithTrick(): GameState {
        const s = createInitialGameState();
        const r1 = startRound(s, noShuffle);
        if (!r1.ok) throw new Error(r1.reason);

        // Active player plays a card to set up trick
        const activeId = r1.state.activePlayerId;
        const card = r1.state.hands[activeId][0];
        const r2 = dispatch(r1.state, { type: "play", playerId: activeId, cards: [card] });
        if (!r2.ok) throw new Error(r2.reason);
        return r2.state;
    }

    it("records pass and advances turn", () => {
        const s = startedWithTrick();
        const currentPlayer = s.activePlayerId;
        const result = dispatch(s, { type: "pass", playerId: currentPlayer });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.state.trick.passedPlayerIds).toContain(currentPlayer);
        expect(result.state.activePlayerId).not.toBe(currentPlayer);
    });

    it("resets trick when all others pass", () => {
        let s = startedWithTrick();
        const topPlayer = s.trick.topPlayerId!;

        // All other players pass
        for (let i = 0; i < 3; i++) {
            const current = s.activePlayerId;
            if (current === topPlayer) break;
            const result = dispatch(s, { type: "pass", playerId: current });
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            s = result.state;
        }

        // Trick should be reset, top player leads
        expect(s.trick.topPlay).toBeNull();
        expect(s.activePlayerId).toBe(topPlayer);
    });
});

describe("8 Stop", () => {
    it("ends trick immediately when 8 is played", () => {
        // Build hands where active player has an 8 and 3D
        const hands: [Card[], Card[], Card[], Card[]] = [
            // P0: has 3D (will lead) and 8H
            [
                new Card("3", "D"), new Card("8", "H"), new Card("4", "D"),
                new Card("5", "D"), new Card("6", "D"), new Card("7", "D"),
                new Card("9", "D"), new Card("10", "D"), new Card("J", "D"),
                new Card("Q", "D"), new Card("K", "D"), new Card("A", "D"),
                new Card("2", "D"),
            ],
            // P1
            [
                new Card("3", "C"), new Card("4", "C"), new Card("5", "C"),
                new Card("6", "C"), new Card("7", "C"), new Card("8", "C"),
                new Card("9", "C"), new Card("10", "C"), new Card("J", "C"),
                new Card("Q", "C"), new Card("K", "C"), new Card("A", "C"),
                new Card("2", "C"),
            ],
            // P2
            [
                new Card("3", "H"), new Card("4", "H"), new Card("5", "H"),
                new Card("6", "H"), new Card("7", "H"), new Card("8", "S"),
                new Card("9", "H"), new Card("10", "H"), new Card("J", "H"),
                new Card("Q", "H"), new Card("K", "H"), new Card("A", "H"),
                new Card("2", "H"),
            ],
            // P3
            [
                new Card("3", "S"), new Card("4", "S"), new Card("5", "S"),
                new Card("6", "S"), new Card("7", "S"), new Card("8", "D"),
                new Card("9", "S"), new Card("10", "S"), new Card("J", "S"),
                new Card("Q", "S"), new Card("K", "S"), new Card("A", "S"),
                new Card("2", "S"),
            ],
        ];

        const deck = buildDeckForHands(hands);
        const s0 = createInitialGameState();
        const r1 = startRound(s0, fixedShuffle(deck));
        if (!r1.ok) throw new Error(r1.reason);
        let s = r1.state;

        expect(s.activePlayerId).toBe(0);

        // P0 plays 3D to start trick
        let r = dispatch(s, { type: "play", playerId: 0, cards: [new Card("3", "D")] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        s = r.state;

        // P1 plays 8C — 8 Stop!
        r = dispatch(s, { type: "play", playerId: 1, cards: [new Card("8", "C")] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        s = r.state;

        // Trick should be cleared and P1 leads
        expect(s.trick.topPlay).toBeNull();
        expect(s.activePlayerId).toBe(1);

        const eightStopEvent = r.events.find((e) => e.type === "eightStop");
        expect(eightStopEvent).toBeDefined();
    });
});

describe("Revolution", () => {
    it("toggles revolution when four-of-a-kind is played", () => {
        const hands: [Card[], Card[], Card[], Card[]] = [
            // P0: 3D + four 4s (but need 13 cards)
            [
                new Card("3", "D"), new Card("4", "D"), new Card("4", "C"),
                new Card("4", "H"), new Card("4", "S"), new Card("6", "D"),
                new Card("7", "D"), new Card("9", "D"), new Card("10", "D"),
                new Card("J", "D"), new Card("Q", "D"), new Card("K", "D"),
                new Card("A", "D"),
            ],
            [
                new Card("3", "C"), new Card("5", "C"), new Card("5", "D"),
                new Card("6", "C"), new Card("7", "C"), new Card("8", "C"),
                new Card("9", "C"), new Card("10", "C"), new Card("J", "C"),
                new Card("Q", "C"), new Card("K", "C"), new Card("A", "C"),
                new Card("2", "C"),
            ],
            [
                new Card("3", "H"), new Card("5", "H"), new Card("5", "S"),
                new Card("6", "H"), new Card("7", "H"), new Card("8", "H"),
                new Card("9", "H"), new Card("10", "H"), new Card("J", "H"),
                new Card("Q", "H"), new Card("K", "H"), new Card("A", "H"),
                new Card("2", "H"),
            ],
            [
                new Card("3", "S"), new Card("8", "D"), new Card("8", "S"),
                new Card("6", "S"), new Card("7", "S"), new Card("2", "D"),
                new Card("9", "S"), new Card("10", "S"), new Card("J", "S"),
                new Card("Q", "S"), new Card("K", "S"), new Card("A", "S"),
                new Card("2", "S"),
            ],
        ];

        const deck = buildDeckForHands(hands);
        const s0 = createInitialGameState();
        const r1 = startRound(s0, fixedShuffle(deck));
        if (!r1.ok) throw new Error(r1.reason);
        let s = r1.state;

        expect(s.revolutionActive).toBe(false);

        // Simulate a later lead after 3D has already been spent.
        s = {
            ...s,
            hands: [
                s.hands[0].filter(
                    (card) => !(card.rank === "3" && card.suit === "D"),
                ),
                s.hands[1],
                s.hands[2],
                s.hands[3],
            ],
        };

        // P0 plays four 4s
        const r = dispatch(s, {
            type: "play",
            playerId: 0,
            cards: [
                new Card("4", "D"),
                new Card("4", "C"),
                new Card("4", "H"),
                new Card("4", "S"),
            ],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;

        expect(r.state.revolutionActive).toBe(true);
        const revEvent = r.events.find((e) => e.type === "revolution");
        expect(revEvent).toBeDefined();
    });
});

describe("player finishing", () => {
    it("marks player finished when hand empties", () => {
        // Give P0 only 3D, rest get normal cards
        // But we need 52 cards total. So give P0 one card in a 4-card deck scenario...
        // Actually we need proper 13 cards each. Let's make P0's hand all the same rank for easy play.

        // Simpler: create a state mid-game where P0 has 1 card left
        const s0 = createInitialGameState();
        const r1 = startRound(s0, noShuffle);
        if (!r1.ok) throw new Error(r1.reason);
        let s = r1.state;

        // Manually set P0 to have 1 card, and be active
        s = {
            ...s,
            activePlayerId: 0,
            hands: [
                [new Card("2", "D")],
                s.hands[1],
                s.hands[2],
                s.hands[3],
            ],
            trick: {
                topPlay: null,
                topPlayerId: null,
                currentPattern: null,
                passedPlayerIds: [],
            },
        };

        const r = dispatch(s, { type: "play", playerId: 0, cards: [new Card("2", "D")] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;

        expect(r.state.finishedPlayers).toContain(0);
        expect(r.state.finishOrder).toContain(0);
        const finishEvent = r.events.find((e) => e.type === "playerFinished");
        expect(finishEvent).toBeDefined();
    });
});

describe("tycoon demotion", () => {
    it("demotes previous Tycoon when another player finishes first", () => {
        const state: GameState = {
            ...createInitialGameState(),
            roundNumber: 2,
            phase: RoundPhase.Play,
            previousRanks: {
                0: PlayerRank.Tycoon,
                1: PlayerRank.Rich,
                2: PlayerRank.Poor,
                3: PlayerRank.Beggar,
            },
            hands: [
                [new Card("3", "D"), new Card("K", "C")],
                [new Card("8", "H")],
                [new Card("5", "D")],
                [new Card("6", "C")],
            ],
            activePlayerId: 1,
            revolutionActive: false,
            finishOrder: [],
            finishedPlayers: [],
            demotedTycoonId: null,
            trick: {
                topPlay: new Play([new Card("4", "D")]),
                topPlayerId: 2,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
            tradeState: null,
        };

        const r = dispatch(state, {
            type: "play",
            playerId: 1,
            cards: [new Card("8", "H")],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;

        expect(r.state.demotedTycoonId).toBe(0);
        expect(r.state.finishedPlayers).toContain(0);
        expect(r.state.finishedPlayers).toContain(1);
        expect(r.events.some((e) => e.type === "tycoonDemoted")).toBe(true);
    });

    it("does not demote when incoming Tycoon finishes first", () => {
        const state: GameState = {
            ...createInitialGameState(),
            roundNumber: 2,
            phase: RoundPhase.Play,
            previousRanks: {
                0: PlayerRank.Tycoon,
                1: PlayerRank.Rich,
                2: PlayerRank.Poor,
                3: PlayerRank.Beggar,
            },
            hands: [
                [new Card("8", "H")],
                [new Card("3", "D"), new Card("K", "C")],
                [new Card("5", "D")],
                [new Card("6", "C")],
            ],
            activePlayerId: 0,
            revolutionActive: false,
            finishOrder: [],
            finishedPlayers: [],
            demotedTycoonId: null,
            trick: {
                topPlay: new Play([new Card("4", "D")]),
                topPlayerId: 2,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
            tradeState: null,
        };

        const r = dispatch(state, {
            type: "play",
            playerId: 0,
            cards: [new Card("8", "H")],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;

        expect(r.state.demotedTycoonId).toBeNull();
        expect(r.events.some((e) => e.type === "tycoonDemoted")).toBe(false);
    });
});

describe("round ending", () => {
    it("ends round when all players finish", () => {
        const s0 = createInitialGameState();
        const r1 = startRound(s0, noShuffle);
        if (!r1.ok) throw new Error(r1.reason);

        // Simulate state where 3 players finished and last one has 1 card
        const s: GameState = {
            ...r1.state,
            activePlayerId: 3,
            hands: [[], [], [], [new Card("2", "S")]],
            finishedPlayers: [0, 1, 2],
            finishOrder: [0, 1, 2],
            trick: {
                topPlay: null,
                topPlayerId: null,
                currentPattern: null,
                passedPlayerIds: [],
            },
        };

        const r = dispatch(s, { type: "play", playerId: 3, cards: [new Card("2", "S")] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;

        const roundFinished = r.events.find((e) => e.type === "roundFinished");
        expect(roundFinished).toBeDefined();
        expect(r.state.scores[0]).toBe(30); // Tycoon
        expect(r.state.scores[3]).toBe(0);  // Beggar
    });
});

describe("full round 1 start", () => {
    it("requires shuffleFn for startRound action", () => {
        const s = createInitialGameState();
        const result = dispatch(s, { type: "startRound" });
        expect(result.ok).toBe(false);
    });

    it("works with shuffleFn via startRound directly", () => {
        const s = createInitialGameState();
        const result = startRound(s, noShuffle);
        expect(result.ok).toBe(true);
    });
});
