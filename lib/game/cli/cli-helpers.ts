import { getRankOrder } from "../core/constants";
import {
    type Card,
    type GameEvent,
    type GameState,
    type PlayerId,
    type RankOrder,
} from "../core/types";

// ---------------------------------------------------------------------------
// Player labels
// ---------------------------------------------------------------------------

const PLAYER_LABELS: Record<PlayerId, string> = {
    0: "Player X",
    1: "Player B",
    2: "Player C",
    3: "Player D",
};

export function playerLabel(id: PlayerId): string {
    return PLAYER_LABELS[id];
}

// ---------------------------------------------------------------------------
// Card formatting
// ---------------------------------------------------------------------------

export function formatCard(card: Card): string {
    return `${card.rank}${card.suit}`;
}

export function formatCards(cards: Card[]): string {
    return cards.map(formatCard).join(" ");
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export function sortCards(cards: Card[], rankOrder: RankOrder): Card[] {
    return [...cards].sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank]);
}

// ---------------------------------------------------------------------------
// Option building for play phase
// ---------------------------------------------------------------------------

export interface PlayOption {
    index: number;
    label: string;
    cards: Card[];
}

export type TrickHistoryEntry =
    | { type: "play"; playerId: PlayerId; cards: Card[] }
    | { type: "pass"; playerId: PlayerId };

export function buildPlayOptions(
    legalPlays: Card[][],
    rankOrder: RankOrder,
): PlayOption[] {
    const sorted = [...legalPlays].sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length;
        return rankOrder[a[0].rank] - rankOrder[b[0].rank];
    });

    return sorted.map((cards, i) => ({
        index: i + 1,
        label: formatCards(cards),
        cards,
    }));
}

export function canPass(state: GameState): boolean {
    return state.trick.topPlay !== null;
}

export function formatTrickHistoryEntry(
    entry: TrickHistoryEntry,
    isCurrentTopPlay = false,
): string {
    if (entry.type === "pass") {
        return `${playerLabel(entry.playerId)} passed`;
    }

    const suffix = isCurrentTopPlay ? " <" : "";
    return `${playerLabel(entry.playerId)} played: ${formatCards(entry.cards)}${suffix}`;
}

// ---------------------------------------------------------------------------
// Trade helpers
// ---------------------------------------------------------------------------

export function selectLowestCards(
    hand: Card[],
    count: number,
    revolutionActive: boolean,
): Card[] {
    const rankOrder = getRankOrder(revolutionActive);
    const sorted = [...hand].sort(
        (a, b) => rankOrder[a.rank] - rankOrder[b.rank],
    );
    return sorted.slice(0, count);
}

// ---------------------------------------------------------------------------
// Event formatting
// ---------------------------------------------------------------------------

export function formatEvent(event: GameEvent): string | null {
    switch (event.type) {
        case "eightStop":
            return "Eight stopped!";
        case "revolution":
            return "*** REVOLUTION! Rank order reversed! ***";
        case "counterRevolution":
            return "*** COUNTER-REVOLUTION! Rank order restored! ***";
        case "playerFinished":
            return `${playerLabel(event.playerId)} finished in position ${event.position}!`;
        case "tycoonDemoted":
            return `${playerLabel(event.playerId)} (incoming Tycoon) is last place this round — out until next round.`;
        case "roundFinished": {
            const lines = ["--- Round Finished ---"];
            for (const [id, rank] of Object.entries(event.ranks)) {
                lines.push(`  ${playerLabel(Number(id) as PlayerId)}: ${rank}`);
            }
            return lines.join("\n");
        }
        case "matchFinished":
            return `\n=== MATCH OVER! ${playerLabel(event.winner)} wins! ===`;
        case "trickEnded":
            return `Trick won by ${playerLabel(event.winner)}. New trick starts.`;
        default:
            return null;
    }
}

export function formatScores(scores: [number, number, number, number]): string {
    return ([0, 1, 2, 3] as PlayerId[])
        .map((id) => `${playerLabel(id)}: ${scores[id]}`)
        .join("  |  ");
}

export function formatHandSizes(hands: [Card[], Card[], Card[], Card[]]) {
    return ([0, 1, 2, 3] as PlayerId[])
        .map((id) => `${playerLabel(id)} hand size: ${hands[id].length}`)
        .join("\n");
}

export function formatTradeRequirement(
    giverId: PlayerId,
    receiverId: PlayerId,
    giverCards: Card[],
    count: number,
): string {
    return `${playerLabel(giverId)} gives ${count} card(s) [${formatCards(giverCards)}] to ${playerLabel(receiverId)}`;
}
