import { describe, expect, it } from "vitest";
import { chooseBotPlay } from "../../../lib/game/bots";
import { createInitialGameState } from "../../../lib/game/engine";
import {
    Card,
    type GameState,
    Play,
    PlayPattern,
    type PlayerId,
    RoundPhase,
} from "../../../lib/game/types";

function baseState(overrides: Partial<GameState>): GameState {
    return { ...createInitialGameState(), ...overrides };
}

describe("chooseBotPlay", () => {
    it("plays lowest card that beats current trick", () => {
        const top = new Play([new Card("5", "D")]);
        const state = baseState({
            phase: RoundPhase.Play,
            activePlayerId: 1 as PlayerId,
            hands: [
                [],
                [new Card("6", "C"), new Card("7", "H"), new Card("4", "S")],
                [],
                [],
            ],
            trick: {
                topPlay: top,
                topPlayerId: 0 as PlayerId,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
        });
        const c = chooseBotPlay(state, 1);
        expect(c.type).toBe("play");
        if (c.type === "play") {
            expect(c.cards).toHaveLength(1);
            expect(c.cards[0]!.rank).toBe("6");
        }
    });

    it("passes when nothing beats trick", () => {
        const top = new Play([new Card("2", "D")]);
        const state = baseState({
            phase: RoundPhase.Play,
            activePlayerId: 1 as PlayerId,
            hands: [[], [new Card("A", "C"), new Card("K", "H")], [], []],
            trick: {
                topPlay: top,
                topPlayerId: 0 as PlayerId,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
        });
        const c = chooseBotPlay(state, 1);
        expect(c.type).toBe("pass");
    });

    it("prefers revolution on new trick when legal", () => {
        const state = baseState({
            phase: RoundPhase.Play,
            activePlayerId: 1 as PlayerId,
            hands: [
                [],
                [
                    new Card("5", "D"),
                    new Card("5", "C"),
                    new Card("5", "H"),
                    new Card("5", "S"),
                    new Card("6", "D"),
                ],
                [],
                [],
            ],
            trick: {
                topPlay: null,
                topPlayerId: null,
                currentPattern: null,
                passedPlayerIds: [],
            },
        });
        const c = chooseBotPlay(state, 1);
        expect(c.type).toBe("play");
        if (c.type === "play") {
            expect(c.cards).toHaveLength(4);
            expect(c.cards.every((x) => x.rank === "5")).toBe(true);
        }
    });
});
