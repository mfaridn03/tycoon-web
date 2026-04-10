import { getRankOrder } from "./constants";
import { formatCards, playerLabel, sortCards } from "./cli-helpers";
import {
    type Card,
    type GameAction,
    type GameEvent,
    type GameState,
    type PlayerId,
    PlayerRank,
    type TradeRequirement,
} from "./types";

const PLAYER_CODES: Record<PlayerId, string> = {
    0: "A",
    1: "B",
    2: "C",
    3: "D",
};

export function playerCode(id: PlayerId): string {
    return PLAYER_CODES[id];
}

function formatHandCards(cards: Card[]): string {
    const text = formatCards(cards);
    return text.length > 0 ? text : "(empty)";
}

export function formatHandLine(
    playerId: PlayerId,
    hand: Card[],
    revolutionActive: boolean,
): string {
    const sorted = sortCards(hand, getRankOrder(revolutionActive));
    return `${playerCode(playerId)}: ${formatHandCards(sorted)} (${sorted.length})`;
}

export function formatHandsBlock(
    hands: GameState["hands"],
    revolutionActive: boolean,
): string[] {
    return ([0, 1, 2, 3] as PlayerId[]).map((playerId) =>
        formatHandLine(playerId, hands[playerId], revolutionActive),
    );
}

export function formatRoleLines(
    ranks: Record<PlayerId, PlayerRank>,
): string[] {
    const roleOrder: readonly PlayerRank[] = [
        PlayerRank.Tycoon,
        PlayerRank.Rich,
        PlayerRank.Poor,
        PlayerRank.Beggar,
    ];

    return roleOrder.map((rank) => {
        const playerId = (Object.entries(ranks) as [string, PlayerRank][])
            .find(([, value]) => value === rank);

        if (!playerId) {
            throw new Error(`Missing player for rank ${rank}`);
        }

        return `${rank.toLowerCase()}: ${playerCode(Number(playerId[0]) as PlayerId)}`;
    });
}

export function formatTradeLines(
    requirements: TradeRequirement[],
): string[] {
    return requirements.flatMap((req) => {
        if (!req.giverCards || !req.receiverCards) {
            throw new Error("Trade log requires completed trades");
        }

        return [
            `${playerCode(req.giverId)} -> ${playerCode(req.receiverId)}: ${formatHandCards(req.giverCards)}`,
            `${playerCode(req.receiverId)} -> ${playerCode(req.giverId)}: ${formatHandCards(req.receiverCards)}`,
        ];
    });
}

export function formatActionLine(action: GameAction): string | null {
    switch (action.type) {
        case "play":
            return `${playerLabel(action.playerId)} played: ${formatHandCards(action.cards)}`;
        case "pass":
            return `${playerCode(action.playerId)}: pass`;
        default:
            return null;
    }
}

export function formatLogEvent(event: GameEvent): string | null {
    switch (event.type) {
        case "eightStop":
            return "Eight stop";
        case "revolution":
            return "Revolution";
        case "counterRevolution":
            return "Counter-revolution";
        case "playerFinished":
            return `${playerLabel(event.playerId)} finished in position ${event.position}`;
        case "tycoonDemoted":
            return `${playerLabel(event.playerId)} demoted to last place`;
        case "roundFinished":
            return "Round finished";
        case "matchFinished":
            return `${playerLabel(event.winner)} wins match`;
        case "trickEnded":
            return `${playerLabel(event.winner)} won trick`;
        default:
            return null;
    }
}
