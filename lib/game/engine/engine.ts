import {
    CARDS_PER_PLAYER,
    createDeck,
    PLAYER_IDS,
    TOTAL_ROUNDS,
} from "../core/constants";
import { applyRoundScores, assignRoundRanks, getMatchWinner } from "../scoring/scoring";
import { applyTrade, findPlayerByRank, startTradePhase } from "../trade/trade";
import {
    type ActionResult,
    type Card,
    type GameAction,
    type GameEvent,
    type GameState,
    Play,
    PlayEffect,
    type PlayerId,
    type PlayPattern,
    PlayerRank,
    RoundPhase,
    type ShuffleFn,
    type TrickState,
} from "../core/types";
import { validatePlay } from "../rules/validation";

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createInitialGameState(): GameState {
    return {
        scores: [0, 0, 0, 0],
        roundNumber: 1,
        matchFinished: false,
        previousRanks: null,
        phase: RoundPhase.Deal,
        hands: [[], [], [], []],
        activePlayerId: 0,
        revolutionActive: false,
        finishOrder: [],
        finishedPlayers: [],
        demotedTycoonId: null,
        roundOneOpeningLeadSatisfied: false,
        trick: emptyTrick(),
        tradeState: null,
    };
}

function emptyTrick(): TrickState {
    return {
        topPlay: null,
        topPlayerId: null,
        currentPattern: null,
        passedPlayerIds: [],
    };
}

// ---------------------------------------------------------------------------
// Deal
// ---------------------------------------------------------------------------

export function dealRound(state: GameState, shuffleFn: ShuffleFn): GameState {
    const deck = shuffleFn(createDeck());
    const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];

    for (let i = 0; i < deck.length; i++) {
        hands[i % 4].push(deck[i]);
    }

    for (const hand of hands) {
        if (hand.length !== CARDS_PER_PLAYER) {
            throw new Error("Deck size mismatch after deal");
        }
    }

    return {
        ...state,
        hands,
        finishOrder: [],
        finishedPlayers: [],
        demotedTycoonId: null,
        roundOneOpeningLeadSatisfied: state.roundOneOpeningLeadSatisfied,
        revolutionActive: false,
        trick: emptyTrick(),
    };
}

// ---------------------------------------------------------------------------
// Find holder of 3D
// ---------------------------------------------------------------------------

function find3DHolder(hands: [Card[], Card[], Card[], Card[]]): PlayerId {
    for (let i = 0; i < 4; i++) {
        if (hands[i].some((c) => c.rank === "3" && c.suit === "D")) {
            return i as PlayerId;
        }
    }
    throw new Error("3 of Diamonds not found in any hand");
}

// ---------------------------------------------------------------------------
// Start round
// ---------------------------------------------------------------------------

export function startRound(
    state: GameState,
    shuffleFn: ShuffleFn,
): ActionResult {
    if (state.roundNumber > TOTAL_ROUNDS) {
        return { ok: false, reason: "Match already finished" };
    }

    if (state.phase !== RoundPhase.Deal && state.phase !== RoundPhase.Finished) {
        return { ok: false, reason: "Cannot start round in current phase" };
    }

    let s = dealRound(state, shuffleFn);

    if (s.roundNumber === 1) {
        const leaderId = find3DHolder(s.hands);
        return {
            ok: true,
            state: { ...s, phase: RoundPhase.Play, activePlayerId: leaderId },
            events: [],
        };
    }

    // Rounds 2/3: trade phase
    s = startTradePhase(s);
    return { ok: true, state: s, events: [] };
}

// ---------------------------------------------------------------------------
// Advance to next active player
// ---------------------------------------------------------------------------

function advancePlayer(
    current: PlayerId,
    finishedPlayers: PlayerId[],
): PlayerId {
    let next = ((current + 1) % 4) as PlayerId;
    let safety = 0;
    while (finishedPlayers.includes(next) && safety < 4) {
        next = ((next + 1) % 4) as PlayerId;
        safety++;
    }
    return next;
}

// ---------------------------------------------------------------------------
// End trick
// ---------------------------------------------------------------------------

function endTrick(
    state: GameState,
    winnerId: PlayerId,
): { state: GameState; events: GameEvent[] } {
    const nextActive = state.finishedPlayers.includes(winnerId)
        ? advancePlayer(winnerId, state.finishedPlayers)
        : winnerId;

    return {
        state: {
            ...state,
            trick: emptyTrick(),
            activePlayerId: nextActive,
        },
        events: [{ type: "trickEnded", winner: winnerId }],
    };
}

// ---------------------------------------------------------------------------
// End round
// ---------------------------------------------------------------------------

function endRound(state: GameState): { state: GameState; events: GameEvent[] } {
    const effectiveFinishOrder =
        state.demotedTycoonId != null
            ? [...state.finishOrder, state.demotedTycoonId]
            : state.finishOrder;
    const ranks = assignRoundRanks(effectiveFinishOrder);
    let s = applyRoundScores({
        ...state,
        finishOrder: effectiveFinishOrder,
        phase: RoundPhase.Finished,
    });
    const events: GameEvent[] = [{ type: "roundFinished", ranks }];

    if (s.roundNumber >= TOTAL_ROUNDS) {
        const winner = getMatchWinner(s.scores);
        s = { ...s, matchFinished: true, revolutionActive: false };
        events.push({ type: "matchFinished", winner });
    } else {
        s = {
            ...s,
            roundNumber: s.roundNumber + 1,
            phase: RoundPhase.Deal,
            revolutionActive: false,
        };
    }

    return { state: s, events };
}

// ---------------------------------------------------------------------------
// Apply move (play cards)
// ---------------------------------------------------------------------------

function applyMoveInternal(
    state: GameState,
    playerId: PlayerId,
    cards: Card[],
): ActionResult {
    const validation = validatePlay(state, playerId, cards);
    if (!validation.valid) {
        return { ok: false, reason: validation.reason };
    }

    const events: GameEvent[] = [];
    const play = new Play(cards);

    // Remove cards from hand
    const newHand = [...state.hands[playerId]];
    for (const card of cards) {
        const idx = newHand.findIndex((c) => c.equals(card));
        newHand.splice(idx, 1);
    }
    const hands = [...state.hands] as [Card[], Card[], Card[], Card[]];
    hands[playerId] = newHand;

    // Update trick
    const trick: TrickState = {
        topPlay: play,
        topPlayerId: playerId,
        currentPattern: play.pattern as PlayPattern,
        passedPlayerIds: [],
    };

    // Revolution toggle
    let revolutionActive = state.revolutionActive;
    if (play.effects.has(PlayEffect.Revolution)) {
        const wasActive = revolutionActive;
        revolutionActive = !revolutionActive;
        events.push(
            wasActive
                ? { type: "counterRevolution" }
                : { type: "revolution" },
        );
    }

    let s: GameState = {
        ...state,
        hands,
        trick,
        revolutionActive,
        roundOneOpeningLeadSatisfied:
            state.roundOneOpeningLeadSatisfied || state.roundNumber === 1,
    };

    // Player finished?
    const finishOrder = [...state.finishOrder];
    const finishedPlayers = [...state.finishedPlayers];

    if (newHand.length === 0) {
        finishedPlayers.push(playerId);
        finishOrder.push(playerId);
        events.push({
            type: "playerFinished",
            playerId,
            position: finishOrder.length,
        });
        let demotedTycoonId = state.demotedTycoonId;
        if (
            finishOrder.length === 1 &&
            state.previousRanks &&
            playerId !== findPlayerByRank(state.previousRanks, PlayerRank.Tycoon)
        ) {
            const tycoonId = findPlayerByRank(
                state.previousRanks,
                PlayerRank.Tycoon,
            );
            if (!finishedPlayers.includes(tycoonId)) {
                finishedPlayers.push(tycoonId);
                demotedTycoonId = tycoonId;
                events.push({ type: "tycoonDemoted", playerId: tycoonId });
            }
        }
        s = { ...s, finishOrder, finishedPlayers, demotedTycoonId };
    }

    // All players finished? End round.
    if (finishedPlayers.length === PLAYER_IDS.length) {
        s = { ...s, finishOrder, finishedPlayers };
        const roundEnd = endRound(s);
        events.push(...roundEnd.events);
        return { ok: true, state: roundEnd.state, events };
    }

    // 8 Stop: trick ends immediately, this player leads next
    if (play.effects.has(PlayEffect.EightStop)) {
        events.push({ type: "eightStop", playerId });
        const trickEnd = endTrick(
            { ...s, finishOrder, finishedPlayers },
            playerId,
        );
        events.push(...trickEnd.events);
        return { ok: true, state: trickEnd.state, events };
    }

    // Advance to next player
    const nextPlayer = advancePlayer(playerId, finishedPlayers);
    s = { ...s, finishOrder, finishedPlayers, activePlayerId: nextPlayer };

    return { ok: true, state: s, events };
}

// ---------------------------------------------------------------------------
// Apply pass
// ---------------------------------------------------------------------------

function applyPassInternal(
    state: GameState,
    playerId: PlayerId,
): ActionResult {
    if (state.phase !== RoundPhase.Play) {
        return { ok: false, reason: "Not in play phase" };
    }
    if (state.activePlayerId !== playerId) {
        return { ok: false, reason: "Not this player's turn" };
    }
    if (state.finishedPlayers.includes(playerId)) {
        return { ok: false, reason: "Player already finished" };
    }

    const passedPlayerIds = [...state.trick.passedPlayerIds, playerId];
    const events: GameEvent[] = [];

    // Check if all remaining active players have passed
    const activePlayers = PLAYER_IDS.filter(
        (id) => !state.finishedPlayers.includes(id),
    );
    const allOthersPassed = activePlayers
        .filter((id) => id !== state.trick.topPlayerId)
        .every((id) => passedPlayerIds.includes(id));

    if (allOthersPassed && state.trick.topPlayerId !== null) {
        const trickEnd = endTrick(state, state.trick.topPlayerId);
        events.push(...trickEnd.events);
        return { ok: true, state: trickEnd.state, events };
    }

    const nextPlayer = advancePlayer(playerId, state.finishedPlayers);
    return {
        ok: true,
        state: {
            ...state,
            trick: { ...state.trick, passedPlayerIds },
            activePlayerId: nextPlayer,
        },
        events,
    };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function dispatch(
    state: GameState,
    action: GameAction,
    shuffleFn?: ShuffleFn,
): ActionResult {
    switch (action.type) {
        case "startRound": {
            if (!shuffleFn) {
                return { ok: false, reason: "shuffleFn required for startRound" };
            }
            return startRound(state, shuffleFn);
        }
        case "completeTrade":
            return applyTrade(state, action.playerId, action.cards);
        case "play":
            return applyMoveInternal(state, action.playerId, action.cards);
        case "pass":
            return applyPassInternal(state, action.playerId);
        case "endMatch": {
            const winner = getMatchWinner(state.scores);
            return {
                ok: true,
                state: { ...state, matchFinished: true, revolutionActive: false },
                events: [{ type: "matchFinished", winner }]
            };
        }
    }
}
