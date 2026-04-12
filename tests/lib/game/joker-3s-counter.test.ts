import { describe, expect, it } from "vitest";
import {
    Card,
    type GameState,
    Play,
    PlayPattern,
    PlayerId,
    RoundPhase,
} from "../../../lib/game/core/types";
import {
    createInitialGameState,
    dispatch,
} from "../../../lib/game/engine/engine";

describe("3s beats Joker", () => {
    it("ends trick immediately when 3S beats a single Joker", () => {
        const state: GameState = {
            ...createInitialGameState(),
            phase: RoundPhase.Play,
            hands: [
                [new Card("3", "S"), new Card("4", "S")],
                [new Card("5", "S")],
                [new Card("6", "S")],
                [new Card("JK", "RJ")],
            ],
            activePlayerId: 0,
            trick: {
                topPlay: new Play([new Card("JK", "RJ")]),
                topPlayerId: 3,
                currentPattern: PlayPattern.One,
                passedPlayerIds: [],
            },
        };

        const result = dispatch(state, {
            type: "play",
            playerId: 0,
            cards: [new Card("3", "S")],
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // The trick should have ended
        expect(result.state.trick.topPlay).toBeNull();
        expect(result.state.trick.topPlayerId).toBeNull();
        
        // Player 0 (who played 3S) should be the active player for the next trick
        expect(result.state.activePlayerId).toBe(0);

        // Events should contain threeSpadeCounter and trickEnded
        expect(result.events.some(e => e.type === "threeSpadeCounter")).toBe(true);
        expect(result.events.some(e => e.type === "trickEnded" && e.winner === 0)).toBe(true);
    });
});
