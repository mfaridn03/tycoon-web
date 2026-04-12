import { getRankOrder } from "../core/constants";
import { validateTrade } from "../rules/validation";
import {
    type ActionResult,
    type Card,
    type GameState,
    type PlayerId,
    PlayerRank,
    RoundPhase,
    type TradeRequirement,
    type TradeState,
} from "../core/types";

/** Trade "highest" uses normal rank order only (new round; ignore revolution). */
function getHighestCards(hand: Card[], count: number): Card[] {
    const rankOrder = getRankOrder(false);
    const sorted = [...hand].sort(
        (a, b) => rankOrder[b.rank] - rankOrder[a.rank],
    );
    return sorted.slice(0, count);
}

export function findPlayerByRank(
    ranks: Record<PlayerId, PlayerRank>,
    target: PlayerRank,
): PlayerId {
    return Number(
        (Object.entries(ranks) as [string, PlayerRank][]).find(
            ([, r]) => r === target,
        )![0],
    ) as PlayerId;
}

export function buildTradeState(
    state: GameState,
): TradeState {
    const ranks = state.previousRanks!;

    const tycoonId = findPlayerByRank(ranks, PlayerRank.Tycoon);
    const richId = findPlayerByRank(ranks, PlayerRank.Rich);
    const poorId = findPlayerByRank(ranks, PlayerRank.Poor);
    const beggarId = findPlayerByRank(ranks, PlayerRank.Beggar);

    const beggarHighest = getHighestCards(state.hands[beggarId], 2);
    const poorHighest = getHighestCards(state.hands[poorId], 1);

    const requirements: TradeRequirement[] = [
        {
            giverId: beggarId,
            receiverId: tycoonId,
            count: 2,
            giverCards: beggarHighest,
            receiverCards: null,
        },
        {
            giverId: poorId,
            receiverId: richId,
            count: 1,
            giverCards: poorHighest,
            receiverCards: null,
        },
    ];

    return { requirements, completed: [false, false] };
}

export function startTradePhase(state: GameState): GameState {
    const tradeState = buildTradeState(state);
    return {
        ...state,
        phase: RoundPhase.Trade,
        tradeState,
    };
}

export function applyTrade(
    state: GameState,
    playerId: PlayerId,
    cards: Card[],
): ActionResult {
    const validation = validateTrade(state, playerId, cards);
    if (!validation.valid) {
        return { ok: false, reason: validation.reason };
    }

    const tradeState = state.tradeState!;
    const reqIndex = tradeState.requirements.findIndex(
        (r) => r.receiverId === playerId,
    );

    const newRequirements = tradeState.requirements.map((r, i) =>
        i === reqIndex ? { ...r, receiverCards: [...cards] } : r,
    );
    const newCompleted = tradeState.completed.map((c, i) =>
        i === reqIndex ? true : c,
    );

    const allDone = newCompleted.every(Boolean);

    if (!allDone) {
        return {
            ok: true,
            state: {
                ...state,
                tradeState: {
                    requirements: newRequirements,
                    completed: newCompleted,
                },
            },
            events: [],
        };
    }

    // All trades complete — execute swaps simultaneously
    const hands = state.hands.map((h) => [...h]) as [
        Card[],
        Card[],
        Card[],
        Card[],
    ];

    for (const req of newRequirements) {
        const giverCards = req.giverCards!;
        const receiverCards = req.receiverCards!;

        // Remove giver's cards from giver hand
        for (const card of giverCards) {
            const idx = hands[req.giverId].findIndex((c) => c.equals(card));
            hands[req.giverId].splice(idx, 1);
        }

        // Remove receiver's cards from receiver hand
        for (const card of receiverCards) {
            const idx = hands[req.receiverId].findIndex((c) =>
                c.equals(card),
            );
            hands[req.receiverId].splice(idx, 1);
        }

        // Give receiver's cards to giver
        hands[req.giverId].push(...receiverCards);

        // Give giver's cards to receiver
        hands[req.receiverId].push(...giverCards);
    }

    const beggarId = findPlayerByRank(
        state.previousRanks!,
        PlayerRank.Beggar,
    );

    return {
        ok: true,
        state: {
            ...state,
            hands,
            phase: RoundPhase.Play,
            activePlayerId: beggarId,
            tradeState: null,
        },
        events: [],
    };
}
