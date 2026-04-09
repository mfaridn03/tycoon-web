import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInitialGameState, dispatch } from "../lib/game/engine";
import { getLegalPlays } from "../lib/game/validation";
import { getRankOrder, TOTAL_ROUNDS } from "../lib/game/constants";
import {
    type Card,
    type GameEvent,
    type GameState,
    type PlayerId,
    RoundPhase,
} from "../lib/game/types";
import {
    buildPlayOptions,
    canPass,
    formatCard,
    formatCards,
    formatEvent,
    formatScores,
    formatTradeRequirement,
    playerLabel,
    selectLowestCards,
    sortCards,
} from "../lib/game/cli-helpers";

const rl = readline.createInterface({ input, output });

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

function printEvents(events: GameEvent[]) {
    for (const ev of events) {
        const msg = formatEvent(ev);
        if (msg) console.log(msg);
    }
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

        const r = dispatch(s, {
            type: "completeTrade",
            playerId: req.receiverId,
            cards: autoCards,
        });

        if (!r.ok) {
            console.log(`Trade error: ${r.reason}`);
            continue;
        }

        printEvents(r.events);
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

    while (s.phase === RoundPhase.Play && safety < 1000) {
        safety++;
        const pid = s.activePlayerId;
        const rankOrder = getRankOrder(s.revolutionActive);
        const hand = sortCards(s.hands[pid], rankOrder);

        printSeparator();
        console.log(`Scores: ${formatScores(s.scores)}`);
        if (s.trick.topPlay) {
            console.log(
                `Table: ${formatCards(s.trick.topPlay.cards)} (by ${playerLabel(s.trick.topPlayerId!)})`,
            );
        } else {
            console.log("Table: empty (new trick)");
        }

        console.log(`\n${playerLabel(pid)}'s turn`);
        console.log(`Hand: ${formatCards(hand)}`);

        const legal = getLegalPlays(s, pid);
        const options = buildPlayOptions(legal, rankOrder);
        const passAllowed = canPass(s);

        if (options.length === 0 && !passAllowed) {
            console.log("No legal plays and cannot pass — this shouldn't happen.");
            break;
        }

        if (passAllowed) {
            console.log("  0) Pass");
        }
        for (const opt of options) {
            console.log(`  ${opt.index}) ${opt.label}`);
        }

        const min = passAllowed ? 0 : 1;
        const max = options.length;
        const choice = await promptNumber("> ", min, max);

        let result;
        if (choice === 0) {
            console.log(`${playerLabel(pid)} passed.`);
            result = dispatch(s, { type: "pass", playerId: pid });
        } else {
            const chosen = options[choice - 1];
            console.log(`${playerLabel(pid)} played: ${chosen.label}`);
            result = dispatch(s, {
                type: "play",
                playerId: pid,
                cards: chosen.cards,
            });
        }

        if (!result.ok) {
            console.log(`Error: ${result.reason}`);
            continue;
        }

        printEvents(result.events);
        s = result.state;
    }

    return s;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
    console.log("=== TYCOON (Daifugō) — CLI ===\n");

    let state = createInitialGameState();

    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
        console.log(`\n========== ROUND ${round} ==========\n`);

        const r = dispatch(
            state,
            { type: "startRound" },
            defaultShuffle,
        );
        if (!r.ok) {
            console.log(`Failed to start round: ${r.reason}`);
            break;
        }
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
