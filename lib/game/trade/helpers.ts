import { selectLowestCards } from "../cli/cli-helpers";
import type {
    Card,
    GameAction,
    GameState,
    PlayerId,
    TradeRequirement,
} from "../core/types";

export interface PendingTradeInfo {
    index: number;
    requirement: TradeRequirement;
}

/** First incomplete trade requirement, or null when all done. */
export function getNextPendingTrade(
    state: GameState,
): PendingTradeInfo | null {
    const ts = state.tradeState;
    if (!ts) return null;
    for (let i = 0; i < ts.requirements.length; i++) {
        if (!ts.completed[i]) {
            return { index: i, requirement: ts.requirements[i] };
        }
    }
    return null;
}

/** True when the pending trade's receiver is the given player. */
export function isHumanTradeTurn(
    state: GameState,
    humanId: PlayerId,
): boolean {
    const pending = getNextPendingTrade(state);
    return pending !== null && pending.requirement.receiverId === humanId;
}

/** Build a completeTrade action for a bot (picks lowest cards). */
export function buildBotTradeAction(
    state: GameState,
    pending: PendingTradeInfo,
): GameAction {
    const { receiverId, count } = pending.requirement;
    const hand = state.hands[receiverId];
    const cards: Card[] = selectLowestCards(hand, count, false);
    return { type: "completeTrade", playerId: receiverId, cards };
}
