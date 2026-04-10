"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { CardDemo } from "@/components/CardDemo";
import { CardBack } from "@/components/cards/CardBack";
import { CardFaceContent } from "@/components/cards/PlayingCard";
import { chooseBotPlay } from "@/lib/game/bots";
import {
  canPass,
  formatScores,
} from "@/lib/game/cli-helpers";
import { createInitialGameState, dispatch } from "@/lib/game/engine";
import { shuffleDeck } from "@/lib/game/shuffle-deck";
import { getLegalPlays } from "@/lib/game/validation";
import type { Card, GameEvent, GameState, PlayerId, TrickState } from "@/lib/game/types";
import { RoundPhase } from "@/lib/game/types";

const STACK_CARD_W = 96;
const STACK_CARD_H = Math.round(STACK_CARD_W * (112 / 80));

const PLAY_CARD_W = 72;
const PLAY_CARD_H = Math.round(PLAY_CARD_W * (112 / 80));

// dx/dy offsets (px) from center of the play area container
const PLAY_ZONE_OFFSETS: Record<number, [number, number]> = {
  0: [0, 72],    // human — below center
  1: [-110, 0],  // bot-left — left of center
  2: [0, -72],   // bot-top — above center
  3: [110, 0],   // bot-right — right of center
};

const BOT_CARD_W = 32;
const BOT_CARD_H = Math.round(BOT_CARD_W * (112 / 80));
const BOT_OVERLAP = 24;
const HAND_SIZE = 13;
const BOT_STRIP_STEP = BOT_CARD_W - BOT_OVERLAP;
const BOT_STRIP_W = BOT_CARD_W + (HAND_SIZE - 1) * BOT_STRIP_STEP;
const FLY_DURATION = 400;
const FLY_STAGGER = 50;
const STACK_DEPTH = HAND_SIZE;
const DEAL_DURATION = (HAND_SIZE - 1) * FLY_STAGGER + FLY_DURATION + 50;
const PLAY_FLY_DURATION = 280;
const CENTER_ZONE_MAX_CARDS = 4;
const CENTER_ZONE_W =
  PLAY_CARD_W * CENTER_ZONE_MAX_CARDS + 4 * (CENTER_ZONE_MAX_CARDS - 1);
const CENTER_ZONE_H = Math.round(PLAY_CARD_H * 1.6);

const HUMAN_ID = 0 as PlayerId;

// Fly-in origin per player: card slides from their table edge to center
const PLAY_ORIGINS: Record<number, string> = {
  0: "translateY(60px)",   // human — bottom
  1: "translateX(-60px)",  // bot-left
  2: "translateY(-60px)",  // bot-top
  3: "translateX(60px)",   // bot-right
};

type TablePhase = "pre" | "dealing" | "playing" | "roundOver";
type BotDealPhase = "idle" | "measuring" | "atStack" | "flying" | "done";
type PlayedCardPhase = "initial" | "landing" | "done";

type CenterCardEntry = {
  cards: Card[];
  playerId: PlayerId;
  animKey: number;
};

type CenterPrevEntry = {
  cards: Card[];
  playerId: PlayerId;
};

// ---------------------------------------------------------------------------
// CenterStack
// ---------------------------------------------------------------------------

function CenterStack({
  stackRef,
  progress,
}: {
  stackRef: RefObject<HTMLDivElement | null>;
  progress: number;
}) {
  const visibleDepth = Math.max(
    0,
    Math.ceil((1 - progress) * STACK_DEPTH),
  );
  const hidden = visibleDepth === 0;

  return (
    <div
      ref={stackRef}
      className="relative shrink-0 overflow-visible transition-[opacity,transform] duration-300"
      style={{
        width: STACK_CARD_W,
        height: STACK_CARD_H + 18,
        opacity: hidden ? 0 : 1,
        transform: hidden ? "scale(0.92)" : "scale(1)",
      }}
    >
      {Array.from({ length: visibleDepth }, (_, index) => {
        const layer = visibleDepth - index - 1;
        return (
          <div
            key={layer}
            style={{
              width: STACK_CARD_W,
              height: STACK_CARD_H,
              position: "absolute",
              top: layer * 1.1,
              left: layer * 0.8,
              opacity: 0.18 + layer * 0.05,
              transform: `scale(${1 - layer * 0.01}) rotate(${layer * -0.2}deg)`,
              filter: "drop-shadow(0 2px 2px rgba(0, 0, 0, 0.18))",
              zIndex: layer,
              pointerEvents: "none",
            }}
          >
            <CardBack />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BotHandStrip
// ---------------------------------------------------------------------------

function BotHandStrip({
  stackRef,
  cards,
  botName,
  rotationDeg,
  showPass,
  className,
}: {
  stackRef: RefObject<HTMLDivElement | null>;
  cards: Card[];
  botName: string;
  rotationDeg: number;
  showPass: boolean;
  className?: string;
}) {
  const [dealPhase, setDealPhase] = useState<BotDealPhase>(() => {
    if (cards.length === 0) return "idle";
    if (cards.length === HAND_SIZE) return "measuring";
    return "done";
  });
  const labelShiftX =
    rotationDeg === 90 ? 20 : rotationDeg === -90 ? -20 : 0;
  const [flyOffsets, setFlyOffsets] = useState<{ x: number; y: number }[]>([]);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Pass flash
  const [isFlashing, setIsFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showPass) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    queueMicrotask(() => setIsFlashing(true));
    flashTimerRef.current = setTimeout(() => setIsFlashing(false), 1000);
  }, [showPass]);

  // Ghost cards for smooth deck shrink when cards are played
  const [ghosts, setGhosts] = useState<number[]>([]);
  const [ghostsVisible, setGhostsVisible] = useState(false);
  const prevCardsLenRef = useRef(cards.length);
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dealPhase !== "done") {
      prevCardsLenRef.current = cards.length;
      return;
    }
    const prevLen = prevCardsLenRef.current;
    prevCardsLenRef.current = cards.length;
    if (cards.length >= prevLen) return;

    const startIdx = cards.length;
    const indices = Array.from({ length: prevLen - cards.length }, (_, k) => startIdx + k);
    setGhosts(indices);
    setGhostsVisible(true);

    let id2: number;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setGhostsVisible(false));
    });
    if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    ghostTimerRef.current = setTimeout(() => setGhosts([]), 420);

    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [cards.length, dealPhase]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (dealPhase !== "measuring") return;
    if (!stackRef.current || cards.length === 0) return;

    const sr = stackRef.current.getBoundingClientRect();
    const scx = sr.left + sr.width / 2;
    const scy = sr.top + sr.height / 2;

    // Viewport-space offsets must be rotated into local (parent-rotated) space
    // so that CSS translate() lands the card at the stack position.
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const offsets = slotRefs.current.map((el) => {
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const vx = scx - (r.left + r.width / 2);
      const vy = scy - (r.top + r.height / 2);
      return {
        x: vx * cos + vy * sin,
        y: -vx * sin + vy * cos,
      };
    });
    setFlyOffsets(offsets);
    setDealPhase("atStack");
  }, [dealPhase, cards, stackRef, rotationDeg]);

  useEffect(() => {
    if (dealPhase !== "atStack") return;
    let id2: number;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setDealPhase("flying"));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [dealPhase]);

  useEffect(() => {
    if (dealPhase !== "flying") return;
    const t = setTimeout(
      () => setDealPhase("done"),
      (HAND_SIZE - 1) * FLY_STAGGER + FLY_DURATION + 50,
    );
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [dealPhase]);

  function slotStyle(index: number): CSSProperties {
    const offset = flyOffsets[index] ?? { x: 0, y: 0 };
    switch (dealPhase) {
      case "idle":
        return { opacity: 0 };
      case "measuring":
        return { opacity: 0 };
      case "atStack":
        return {
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          opacity: 1,
        };
      case "flying":
        return {
          transform: "translate(0, 0)",
          transition: `transform ${FLY_DURATION}ms ease-out ${index * FLY_STAGGER}ms`,
          opacity: 1,
        };
      case "done":
        return { opacity: 1 };
      default:
        return {};
    }
  }

  const isAnimating = !["idle", "done"].includes(dealPhase);

  return (
    <div
      className={className}
      style={{
        transform: `rotate(${rotationDeg}deg)`,
        transformOrigin: "center center",
      }}
    >
      <div className="flex flex-col items-center pointer-events-none">
        <div
          style={{
            transform: `rotate(${-rotationDeg}deg)`,
            transformOrigin: "center center",
            width: BOT_STRIP_W,
            whiteSpace: "nowrap",
          }}
          className="mb-0.5 flex flex-col items-center gap-0.5 select-none"
        >
          <div style={{ transform: `translateX(${labelShiftX}px)` }} className="flex flex-col items-center gap-1">
            <div
              className="text-xs font-semibold leading-none"
              style={{ color: isFlashing ? "#f87171" : "#d1fae5", transition: "color 200ms ease" }}
            >
              {botName}
            </div>
            <div
              className="text-[11px] leading-none"
              style={{ color: isFlashing ? "#fca5a5" : "rgba(167,243,208,0.8)", transition: "color 200ms ease" }}
            >
              {cards.length} cards
            </div>
          </div>
        </div>

        <div
          className={`relative ${
            isAnimating ? "opacity-95" : "opacity-100"
          }`}
          style={{ width: BOT_STRIP_W, minHeight: BOT_CARD_H + 8 }}
        >
          {cards.map((_, i) => (
            <div
              key={i}
              ref={(el) => {
                slotRefs.current[i] = el;
              }}
              style={{
                width: BOT_CARD_W,
                height: BOT_CARD_H,
                position: "absolute",
                left: i * BOT_STRIP_STEP,
                top: 0,
                zIndex: i,
                ...slotStyle(i),
              }}
            >
              <div style={{ width: BOT_CARD_W, height: BOT_CARD_H }}>
                <CardBack />
              </div>
            </div>
          ))}
          {ghosts.map((i) => (
            <div
              key={`ghost-${i}`}
              style={{
                width: BOT_CARD_W,
                height: BOT_CARD_H,
                position: "absolute",
                left: i * BOT_STRIP_STEP,
                top: 0,
                zIndex: i,
                opacity: ghostsVisible ? 1 : 0,
                transition: "opacity 380ms ease-out",
                pointerEvents: "none",
              }}
            >
              <div style={{ width: BOT_CARD_W, height: BOT_CARD_H }}>
                <CardBack />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Face-up cards (SVG row, no interaction)
// ---------------------------------------------------------------------------

function FaceUpCards({ cards }: { cards: Card[] }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {cards.map((card, i) => (
        <svg
          key={i}
          viewBox="0 0 80 112"
          width={PLAY_CARD_W}
          height={PLAY_CARD_H}
          style={{ display: "block", flexShrink: 0 }}
        >
          <CardFaceContent rank={card.rank} suit={card.suit} />
        </svg>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnimatedPlayedCards — whole card row slides in from player's direction
// ---------------------------------------------------------------------------

function AnimatedPlayedCards({
  cards,
  playerId,
}: {
  cards: Card[];
  playerId: PlayerId;
}) {
  const [phase, setPhase] = useState<PlayedCardPhase>("initial");

  useEffect(() => {
    let id2: number;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setPhase("landing"));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, []);

  useEffect(() => {
    if (phase !== "landing") return;
    const t = setTimeout(() => setPhase("done"), PLAY_FLY_DURATION + 50);
    return () => clearTimeout(t);
  }, [phase]);

  const origin = PLAY_ORIGINS[playerId] ?? "translateY(60px)";

  const style: CSSProperties = {
    transform: phase === "initial" ? origin : "translate(0,0)",
    opacity: phase === "initial" ? 0 : 1,
    transition:
      phase === "landing"
        ? `transform ${PLAY_FLY_DURATION}ms ease-out, opacity ${Math.round(PLAY_FLY_DURATION * 0.6)}ms ease-out`
        : undefined,
    filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.45))",
  };

  return (
    <div style={style}>
      <FaceUpCards cards={cards} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FadingPrev — greyed previous play: fades IN from full card, fades OUT when cleared
// ---------------------------------------------------------------------------

type PrevPhase = "fresh" | "settled" | "fading";

function FadingPrev({ prev, playerId }: { prev: CenterPrevEntry | null; playerId: PlayerId }) {
  const [displayed, setDisplayed] = useState<CenterPrevEntry | null>(null);
  const [phase, setPhase] = useState<PrevPhase>("settled");
  const displayedRef = useRef<CenterPrevEntry | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIds = useRef<number[]>([]);

  useEffect(() => {
    const cancel = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      rafIds.current.forEach(cancelAnimationFrame);
      rafIds.current = [];
    };

    const next = prev?.playerId === playerId ? prev : null;

    if (next) {
      cancel();
      displayedRef.current = next;
      // Mount in "fresh" (full-card) appearance, then transition to grey
      queueMicrotask(() => {
        setDisplayed(next);
        setPhase("fresh");
      });
      const id1 = requestAnimationFrame(() => {
        const id2 = requestAnimationFrame(() => setPhase("settled"));
        rafIds.current.push(id2);
      });
      rafIds.current.push(id1);
    } else if (displayedRef.current) {
      cancel();
      // Ensure "settled" is painted before triggering fade-out
      const id1 = requestAnimationFrame(() => {
        const id2 = requestAnimationFrame(() => {
          setPhase("fading");
          timerRef.current = setTimeout(() => {
            setDisplayed(null);
            displayedRef.current = null;
          }, 400);
        });
        rafIds.current.push(id2);
      });
      rafIds.current.push(id1);
    }

    return cancel;
   
  }, [prev, playerId]);

  if (!displayed) return null;

  const isFresh = phase === "fresh";
  const isFading = phase === "fading";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        transform: `scale(${isFresh ? 1 : 0.88})`,
        transformOrigin: "bottom center",
        opacity: isFresh ? 1 : isFading ? 0 : 0.38,
        transition: isFresh
          ? "none"
          : "opacity 360ms ease, transform 360ms ease, filter 360ms ease",
        filter: isFresh ? "none" : "grayscale(65%)",
        marginBottom: -(PLAY_CARD_H * 0.45),
      }}
    >
      <FaceUpCards cards={displayed.cards} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerPlayZone — prev (greyed, peeking above) + current (animated) per slot
// ---------------------------------------------------------------------------

function PlayerPlayZone({
  playerId,
  current,
  prev,
}: {
  playerId: PlayerId;
  current: CenterCardEntry | null;
  prev: CenterPrevEntry | null;
}) {
  const showCurrent = current?.playerId === playerId;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FadingPrev prev={prev} playerId={playerId} />
      {showCurrent && (
        <div style={{ position: "relative", zIndex: 2 }}>
          <AnimatedPlayedCards
            key={current!.animKey}
            cards={current!.cards}
            playerId={playerId}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AllPlayZones — four dedicated card-play areas, one per player
// ---------------------------------------------------------------------------

function AllPlayZones({
  current,
  prev,
}: {
  current: CenterCardEntry | null;
  prev: CenterPrevEntry | null;
}) {
  return (
    <>
      {([0, 1, 2, 3] as PlayerId[]).map((pid) => {
        const [dx, dy] = PLAY_ZONE_OFFSETS[pid];
        return (
          <div
            key={pid}
            style={{
              position: "absolute",
              width: CENTER_ZONE_W,
              height: CENTER_ZONE_H,
              left: `calc(50% + ${dx}px)`,
              top: `calc(50% + ${dy}px)`,
              transform: "translate(-50%, -50%)",
              zIndex: current?.playerId === pid ? 10 : 1,
            }}
          >
            <PlayerPlayZone playerId={pid} current={current} prev={prev} />
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// GameTablePrototype
// ---------------------------------------------------------------------------

export function GameTablePrototype() {
  const stackRef = useRef<HTMLDivElement>(null);
  const [tablePhase, setTablePhase] = useState<TablePhase>("pre");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dealId, setDealId] = useState(0);
  /** 0–1 while dealing; ignored when not dealing (see `stackProgress`). */
  const [dealingStackProgress, setDealingStackProgress] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);

  // Center play display state
  const [centerCurrent, setCenterCurrent] = useState<CenterCardEntry | null>(null);
  const [centerPrev, setCenterPrev] = useState<CenterPrevEntry | null>(null);
  const [visiblePassers, setVisiblePassers] = useState<Set<PlayerId>>(new Set());
  const prevTrickRef = useRef<TrickState | null>(null);
  const centerCurrentRef = useRef<CenterCardEntry | null>(null);
  const animKeyRef = useRef(0);
  const passTimersRef = useRef<Map<PlayerId, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup pass timers on unmount
  useEffect(
    () => () => {
      passTimersRef.current.forEach(clearTimeout);
    },
    [],
  );

  const stackProgress =
    tablePhase === "pre"
      ? 0
      : tablePhase === "dealing"
        ? dealingStackProgress
        : 1;

  const clearCenterState = useCallback(() => {
    setCenterCurrent(null);
    setCenterPrev(null);
    setVisiblePassers(new Set());
    centerCurrentRef.current = null;
    prevTrickRef.current = null;
    passTimersRef.current.forEach(clearTimeout);
    passTimersRef.current.clear();
  }, []);

  const startGame = useCallback(() => {
    setPlayError(null);
    clearCenterState();
    const s0 = createInitialGameState();
    const r = dispatch(s0, { type: "startRound" }, shuffleDeck);
    if (!r.ok) {
      setPlayError(r.reason);
      return;
    }
    setGameState(r.state);
    setDealId((n) => n + 1);
    setDealingStackProgress(0);
    setTablePhase("dealing");
  }, [clearCenterState]);

  const resetGame = useCallback(() => {
    setGameState(null);
    setPlayError(null);
    setTablePhase("pre");
    clearCenterState();
  }, [clearCenterState]);

  const onPlayerDealComplete = useCallback(() => {
    setTablePhase("playing");
  }, []);

  const handleHumanPlay = useCallback((cards: Card[]) => {
    setPlayError(null);
    setGameState((prev) => {
      if (!prev) return prev;
      const r = dispatch(prev, { type: "play", playerId: HUMAN_ID, cards });
      if (!r.ok) {
        queueMicrotask(() => setPlayError(r.reason));
        return prev;
      }
      if (r.events.some((e: GameEvent) => e.type === "roundFinished")) {
        queueMicrotask(() => setTablePhase("roundOver"));
      }
      return r.state;
    });
  }, []);

  const handlePass = useCallback(() => {
    setPlayError(null);
    setGameState((prev) => {
      if (!prev) return prev;
      const r = dispatch(prev, { type: "pass", playerId: HUMAN_ID });
      if (!r.ok) {
        queueMicrotask(() => setPlayError(r.reason));
        return prev;
      }
      if (r.events.some((e: GameEvent) => e.type === "roundFinished")) {
        queueMicrotask(() => setTablePhase("roundOver"));
      }
      return r.state;
    });
  }, []);

  // Bot turns — 1 second delay for pacing
  useEffect(() => {
    if (tablePhase !== "playing" || !gameState) return;
    if (gameState.phase !== RoundPhase.Play) return;
    if (gameState.activePlayerId === HUMAN_ID) return;

    const t = setTimeout(() => {
      setGameState((prev) => {
        if (!prev || prev.phase !== RoundPhase.Play) return prev;
        if (prev.activePlayerId === HUMAN_ID) return prev;
        const pid = prev.activePlayerId;
        const choice = chooseBotPlay(prev, pid);
        const action =
          choice.type === "pass"
            ? { type: "pass" as const, playerId: pid }
            : { type: "play" as const, playerId: pid, cards: choice.cards };
        const r = dispatch(prev, action);
        if (!r.ok) return prev;
        if (r.events.some((e: GameEvent) => e.type === "roundFinished")) {
          queueMicrotask(() => setTablePhase("roundOver"));
        }
        return r.state;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [gameState, tablePhase]);

  // Track trick state changes → update center card display
  useEffect(() => {
    if (!gameState) {
      prevTrickRef.current = null;
      return;
    }

    const prev = prevTrickRef.current;
    const curr = gameState.trick;
    prevTrickRef.current = curr;

    if (!prev) return; // first render — establish baseline only

    // New play landed on top
    if (curr.topPlay !== null && curr.topPlay !== prev.topPlay) {
      const newEntry: CenterCardEntry = {
        cards: curr.topPlay.cards,
        playerId: curr.topPlayerId!,
        animKey: ++animKeyRef.current,
      };
      const prevEntry = centerCurrentRef.current
        ? {
            cards: centerCurrentRef.current.cards,
            playerId: centerCurrentRef.current.playerId,
          }
        : null;
      centerCurrentRef.current = newEntry;
      queueMicrotask(() => {
        setCenterPrev(prevEntry);
        setCenterCurrent(newEntry);
      });
    }

    // Trick ended — clear the table
    if (curr.topPlay === null && prev.topPlay !== null) {
      centerCurrentRef.current = null;
      passTimersRef.current.forEach(clearTimeout);
      passTimersRef.current.clear();
      queueMicrotask(() => {
        setCenterCurrent(null);
        setCenterPrev(null);
        setVisiblePassers(new Set());
      });
    }

    // New passers since last state
    const prevPassed = new Set(prev.passedPlayerIds);
    const newPassers = curr.passedPlayerIds.filter((id) => !prevPassed.has(id));
    for (const pid of newPassers) {
      const existing = passTimersRef.current.get(pid);
      if (existing) clearTimeout(existing);
      queueMicrotask(() => {
        setVisiblePassers((s) => new Set([...s, pid]));
      });
      const t = setTimeout(() => {
        setVisiblePassers((s) => {
          const next = new Set(s);
          next.delete(pid);
          return next;
        });
        passTimersRef.current.delete(pid);
      }, 1000);
      passTimersRef.current.set(pid, t);
    }
  }, [gameState]);

  useEffect(() => {
    if (tablePhase !== "dealing") return;

    let rafId = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const next = Math.min(1, (now - startedAt) / DEAL_DURATION);
      setDealingStackProgress(next);
      if (next < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [tablePhase, dealId]);

  const showTable = tablePhase !== "pre";
  const hands = gameState?.hands ?? null;
  const [, botLeft, botTop, botRight] = hands ?? [[], [], [], []];

  const playMode =
    tablePhase === "playing" &&
    gameState?.phase === RoundPhase.Play &&
    gameState.activePlayerId === HUMAN_ID
      ? {
          canPass: canPass(gameState),
          onPlay: handleHumanPlay,
          onPass: handlePass,
          playError,
        }
      : null;
  const legalPlays =
    playMode && gameState ? getLegalPlays(gameState, HUMAN_ID) : null;

  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-green-950"
      style={
        gameState?.revolutionActive
          ? { background: "linear-gradient(to bottom, #450a0a, #7f1d1d, #450a0a)" }
          : undefined
      }
    >
      <div
        className={`relative flex min-h-dvh flex-col transition-[filter,opacity] duration-300 ${
          tablePhase === "pre" ? "blur-sm" : ""
        }`}
      >
        {/* Table surface glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: gameState?.revolutionActive
              ? `radial-gradient(ellipse 80% 60% at 50% 45%, rgba(185, 16, 16, 0.35), transparent 70%)`
              : `radial-gradient(ellipse 80% 60% at 50% 45%, rgba(16, 185, 129, 0.25), transparent 70%)`,
          }}
        />

        <div className="relative flex min-h-dvh flex-col px-2 pb-6 pt-3">
          {/* Top bot */}
          {showTable && hands && (
            <div className="flex shrink-0 justify-center pt-3 pb-1">
              <BotHandStrip
                key={`bot-top-${dealId}`}
                stackRef={stackRef}
                cards={botTop}
                botName="Bot B"
                rotationDeg={180}
                showPass={visiblePassers.has(2 as PlayerId)}
                className=""
              />
            </div>
          )}

          <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(48px,auto)_1fr_minmax(48px,auto)] items-center gap-1 px-0">
            {showTable && hands && (
              <BotHandStrip
                key={`bot-left-${dealId}`}
                stackRef={stackRef}
                cards={botLeft}
                botName="Bot A"
                rotationDeg={90}
                showPass={visiblePassers.has(1 as PlayerId)}
                className="justify-self-start pl-1"
              />
            )}

            {/* Center area */}
            <div className="relative flex min-h-[220px] flex-col items-center justify-center gap-2 px-1">
              {/* Deal stack — only rendered while not in play (keeps stackRef valid during deal) */}
              {showTable && tablePhase !== "playing" && tablePhase !== "roundOver" && (
                <CenterStack stackRef={stackRef} progress={stackProgress} />
              )}

              {/* Four dedicated play zones */}
              {tablePhase === "playing" && (
                <AllPlayZones current={centerCurrent} prev={centerPrev} />
              )}
            </div>

            {showTable && hands && (
              <BotHandStrip
                key={`bot-right-${dealId}`}
                stackRef={stackRef}
                cards={botRight}
                botName="Bot C"
                rotationDeg={-90}
                showPass={visiblePassers.has(3 as PlayerId)}
                className="justify-self-end pr-1"
              />
            )}
          </div>

          {/* Player */}
          {showTable && hands && (
            <div className="mt-auto w-full pb-4 pt-2">
              <CardDemo
                key={dealId}
                variant="embedded"
                externalStackRef={stackRef}
                playerCards={hands[0]!}
                legalPlays={legalPlays}
                onDealComplete={onPlayerDealComplete}
                gameHandSync={tablePhase === "playing"}
                playMode={playMode}
                className="flex w-full flex-col items-center gap-3"
              />
            </div>
          )}
        </div>
      </div>

      {tablePhase === "pre" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={startGame}
              className="rounded-full bg-white px-10 py-3 text-base font-semibold text-emerald-950 shadow-lg transition hover:bg-emerald-50 active:scale-[0.98]"
            >
              Start Game
            </button>
            {playError ? (
              <p className="max-w-sm text-center text-sm text-red-200">{playError}</p>
            ) : null}
          </div>
        </div>
      )}

      {tablePhase === "roundOver" && gameState && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="mx-4 flex max-w-md flex-col items-center gap-4 rounded-2xl bg-emerald-950/90 px-8 py-6 text-center shadow-xl ring-1 ring-emerald-500/30">
            <h2 className="text-lg font-semibold text-emerald-50">Round complete</h2>
            <p className="text-sm leading-relaxed text-emerald-100/90">
              {formatScores(gameState.scores)}
            </p>
            <button
              type="button"
              onClick={resetGame}
              className="rounded-full bg-white px-8 py-2.5 text-sm font-semibold text-emerald-950 shadow transition hover:bg-emerald-50 active:scale-[0.98]"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
