import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInitialGameState, dispatch } from "../lib/game/engine";
import { getLegalPlays } from "../lib/game/validation";
import { getRankOrder, TOTAL_ROUNDS } from "../lib/game/constants";
import {
    type ActionResult,
    type Card,
    type GameAction,
    type GameEvent,
    type GameState,
    type PlayerId,
    RoundPhase,
} from "../lib/game/types";
import {
    buildPlayOptions,
    canPass,
    formatCards,
    formatEvent,
    formatHandSizes,
    formatScores,
    formatTradeRequirement,
    formatTrickHistoryEntry,
    playerLabel,
    selectLowestCards,
    sortCards,
    type TrickHistoryEntry,
} from "../lib/game/cli-helpers";

const rl = readline.createInterface({ input, output });
const isInteractiveCli = Boolean(input.isTTY && output.isTTY);

const GAME_LOG_PATH =
    process.env.TYCOON_GAME_LOG ?? path.join(process.cwd(), "game-history.json");

type SerializedCard = { rank: Card["rank"]; suit: Card["suit"] };

type SerializedAction =
    | { type: "startRound" }
    | { type: "pass"; playerId: PlayerId }
    | {
          type: "play" | "completeTrade";
          playerId: PlayerId;
          cards: SerializedCard[];
      };

type SerializedLogEntry = {
    round: GameState["roundNumber"];
    phase: GameState["phase"];
    action: SerializedAction;
    events: GameEvent[];
    state: {
        scores: GameState["scores"];
        activePlayerId: GameState["activePlayerId"];
        finishOrder: GameState["finishOrder"];
        finishedPlayers: GameState["finishedPlayers"];
        demotedTycoonId: GameState["demotedTycoonId"];
        revolutionActive: GameState["revolutionActive"];
        handSizes: number[];
        trick: {
            topPlayerId: GameState["trick"]["topPlayerId"];
            currentPattern: GameState["trick"]["currentPattern"];
            topPlayCards: SerializedCard[] | null;
            passedPlayerIds: GameState["trick"]["passedPlayerIds"];
        };
    };
};

type GameLogDocument = {
    type: "gameSession";
    startedAt: string;
    logPath: string;
    entries: SerializedLogEntry[];
};

let gameLog: GameLogDocument | null = null;

function initGameLogFile(): void {
    gameLog = {
        type: "gameSession",
        startedAt: new Date().toISOString(),
        logPath: GAME_LOG_PATH,
        entries: [],
    };
    flushGameLog();
}

function flushGameLog(): void {
    if (!gameLog) {
        throw new Error("Game log not initialized");
    }

    fs.writeFileSync(GAME_LOG_PATH, `${JSON.stringify(gameLog, null, 2)}\n`, "utf8");
}

function serializeCard(card: Card): SerializedCard {
    return {
        rank: card.rank,
        suit: card.suit,
    };
}

function serializeAction(action: GameAction): SerializedAction {
    switch (action.type) {
        case "play":
            return {
                type: action.type,
                playerId: action.playerId,
                cards: action.cards.map(serializeCard),
            };
        case "completeTrade":
            return {
                type: action.type,
                playerId: action.playerId,
                cards: action.cards.map(serializeCard),
            };
        case "pass":
            return { type: action.type, playerId: action.playerId };
        case "startRound":
            return { type: action.type };
    }
}

function serializeState(state: GameState): SerializedLogEntry["state"] {
    return {
        scores: [...state.scores],
        activePlayerId: state.activePlayerId,
        finishOrder: [...state.finishOrder],
        finishedPlayers: [...state.finishedPlayers],
        demotedTycoonId: state.demotedTycoonId,
        revolutionActive: state.revolutionActive,
        handSizes: state.hands.map((hand) => hand.length),
        trick: {
            topPlayerId: state.trick.topPlayerId,
            currentPattern: state.trick.currentPattern,
            topPlayCards: state.trick.topPlay?.cards.map(serializeCard) ?? null,
            passedPlayerIds: [...state.trick.passedPlayerIds],
        },
    };
}

function appendGameLog(
    state: GameState,
    action: GameAction,
    events: GameEvent[],
): void {
    if (!gameLog) {
        throw new Error("Game log not initialized");
    }

    const entry: SerializedLogEntry = {
        round: state.roundNumber,
        phase: state.phase,
        action: serializeAction(action),
        events,
        state: serializeState(state),
    };

    gameLog.entries.push(entry);
    flushGameLog();
}

function defaultShuffle(deck: Card[]): Card[] {
    const arr = [...deck];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function printSeparator() {
    console.log("─".repeat(50));
}

function clearScreenIfInteractive() {
    if (!isInteractiveCli) return;
    output.write("\x1b[2J\x1b[3J\x1b[H");
}

function printEvents(events: GameEvent[]) {
    for (const ev of events) {
        const msg = formatEvent(ev);
        if (msg) console.log(msg);
    }
}

function printMessages(messages: string[]) {
    for (const message of messages) {
        console.log(message);
    }
}

function getEventMessages(events: GameEvent[]): string[] {
    return events.flatMap((ev) => {
        const msg = formatEvent(ev);
        return msg ? [msg] : [];
    });
}

function isCurrentTopHistoryEntry(
    state: GameState,
    entry: TrickHistoryEntry,
): boolean {
    if (entry.type !== "play" || !state.trick.topPlay || state.trick.topPlayerId === null) {
        return false;
    }

    return (
        entry.playerId === state.trick.topPlayerId &&
        formatCards(entry.cards) === formatCards(state.trick.topPlay.cards)
    );
}

function renderPlayScreen(
    state: GameState,
    trickHistory: TrickHistoryEntry[],
    eventMessages: string[],
) {
    const pid = state.activePlayerId;
    const rankOrder = getRankOrder(state.revolutionActive);
    const hand = sortCards(state.hands[pid], rankOrder);
    const legal = getLegalPlays(state, pid);
    const options = buildPlayOptions(legal, rankOrder);
    const passAllowed = canPass(state);

    clearScreenIfInteractive();
    console.log(`Scores: ${formatScores(state.scores)}\n`);
    console.log(formatHandSizes(state.hands));
    printSeparator();
    for (const entry of trickHistory) {
        console.log(
            formatTrickHistoryEntry(entry, isCurrentTopHistoryEntry(state, entry)),
        );
    }

    for (const msg of eventMessages) {
        console.log(msg);
    }

    console.log(`\n${playerLabel(pid)}'s turn`);
    console.log(`Hand: ${formatCards(hand)}`);

    if (passAllowed) {
        console.log("  0) Pass");
    }
    for (const opt of options) {
        console.log(`  ${opt.index}) ${opt.label}`);
    }

    printSeparator();

    return { options, passAllowed };
}

async function promptNumber(prompt: string, min: number, max: number): Promise<number> {
    while (true) {
        const raw = await rl.question(prompt);
        const n = Number(raw.trim());
        if (Number.isInteger(n) && n >= min && n <= max) return n;
        console.log(`Enter a number between ${min} and ${max}.`);
    }
}

// ---------------------------------------------------------------------------
// Trade phase
// ---------------------------------------------------------------------------

async function handleTradePhase(state: GameState): Promise<GameState> {
    if (state.phase !== RoundPhase.Trade || !state.tradeState) return state;

    console.log("\n=== TRADE PHASE ===");
    let s = state;

    const numReqs = s.tradeState!.requirements.length;
    for (let i = 0; i < numReqs; i++) {
        if (!s.tradeState) break;
        const req = s.tradeState.requirements[i];
        if (s.tradeState.completed[i]) continue;

        console.log(
            formatTradeRequirement(
                req.giverId,
                req.receiverId,
                req.giverCards!,
                req.count,
            ),
        );

        const receiverHand = s.hands[req.receiverId];
        const rankOrder = getRankOrder(s.revolutionActive);
        const sorted = sortCards(receiverHand, rankOrder);

        console.log(
            `${playerLabel(req.receiverId)}'s hand: ${formatCards(sorted)}`,
        );

        const autoCards = selectLowestCards(
            receiverHand,
            req.count,
            s.revolutionActive,
        );
        console.log(
            `Auto-selecting lowest ${req.count} card(s): ${formatCards(autoCards)}`,
        );

        const action: GameAction = {
            type: "completeTrade",
            playerId: req.receiverId,
            cards: autoCards,
        };
        const r = dispatch(s, action);

        if (!r.ok) {
            console.log(`Trade error: ${r.reason}`);
            continue;
        }

        printEvents(r.events);
        appendGameLog(r.state, action, r.events);
        s = r.state;
    }

    console.log("Trades complete.\n");
    return s;
}

// ---------------------------------------------------------------------------
// Play phase
// ---------------------------------------------------------------------------

async function handlePlayPhase(state: GameState): Promise<GameState> {
    let s = state;
    let safety = 0;
    let trickHistory: TrickHistoryEntry[] = [];
    let eventMessages: string[] = [];

    while (s.phase === RoundPhase.Play && safety < 1000) {
        safety++;
        const pid = s.activePlayerId;
        const { options, passAllowed } = renderPlayScreen(
            s,
            trickHistory,
            eventMessages,
        );
        eventMessages = [];

        if (options.length === 0 && !passAllowed) {
            console.log("No legal plays and cannot pass — this shouldn't happen.");
            break;
        }

        const min = passAllowed ? 0 : 1;
        const max = options.length;
        const choice = await promptNumber("> ", min, max);

        let result: ActionResult;
        let historyEntry: TrickHistoryEntry;
        let action: GameAction;
        if (choice === 0) {
            historyEntry = { type: "pass", playerId: pid };
            action = { type: "pass", playerId: pid };
            result = dispatch(s, action);
        } else {
            const chosen = options[choice - 1];
            historyEntry = { type: "play", playerId: pid, cards: chosen.cards };
            action = {
                type: "play",
                playerId: pid,
                cards: chosen.cards,
            };
            result = dispatch(s, action);
        }

        if (!result.ok) {
            eventMessages = [`Error: ${result.reason}`];
            continue;
        }

        appendGameLog(result.state, action, result.events);
        trickHistory = [...trickHistory, historyEntry];
        eventMessages = getEventMessages(result.events);
        if (result.events.some((event) => event.type === "trickEnded")) {
            trickHistory = [];
        }
        s = result.state;
    }

    if (eventMessages.length > 0) {
        printMessages(eventMessages);
    }

    return s;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
    console.log("=== TYCOON — CLI ===\n");
    initGameLogFile();

    let state = createInitialGameState();

    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
        console.log(`\n========== ROUND ${round} ==========\n`);

        const startAction: GameAction = { type: "startRound" };
        const r = dispatch(state, startAction, defaultShuffle);
        if (!r.ok) {
            console.log(`Failed to start round: ${r.reason}`);
            break;
        }
        appendGameLog(r.state, startAction, r.events);
        state = r.state;

        if (state.phase === RoundPhase.Trade) {
            state = await handleTradePhase(state);
        }

        state = await handlePlayPhase(state);

        console.log(`\nScores after round ${round}: ${formatScores(state.scores)}`);
    }

    console.log("\n========== FINAL SCORES ==========");
    console.log(formatScores(state.scores));

    rl.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
