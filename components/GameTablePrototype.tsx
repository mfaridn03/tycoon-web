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
import { createDeck } from "@/lib/game/constants";
import { dealFourHands } from "@/lib/game/deal-four-hands";
import { shuffleDeck } from "@/lib/game/shuffle-deck";
import type { Card } from "@/lib/game/types";

const STACK_CARD_W = 96;
const STACK_CARD_H = Math.round(STACK_CARD_W * (112 / 80));

const BOT_CARD_W = 32;
const BOT_CARD_H = Math.round(BOT_CARD_W * (112 / 80));
const BOT_OVERLAP = 24;

const HAND_SIZE = 13;
const FLY_DURATION = 400;
const FLY_STAGGER = 50;

type TablePhase = "pre" | "dealing" | "ready";

type BotDealPhase = "idle" | "measuring" | "atStack" | "flying" | "done";

function BotHandStrip({
  stackRef,
  cards,
  rotationDeg,
  className,
}: {
  stackRef: RefObject<HTMLDivElement | null>;
  cards: Card[];
  rotationDeg: number;
  className?: string;
}) {
  const [dealPhase, setDealPhase] = useState<BotDealPhase>(() =>
    cards.length === HAND_SIZE ? "measuring" : "idle",
  );
  const [flyOffsets, setFlyOffsets] = useState<{ x: number; y: number }[]>([]);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
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
      <div
        className={`flex items-center justify-center pointer-events-none ${
          isAnimating ? "opacity-95" : "opacity-100"
        }`}
        style={{ minHeight: BOT_CARD_H + 8 }}
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
              marginLeft: i === 0 ? 0 : -BOT_OVERLAP,
              zIndex: i,
              ...slotStyle(i),
            }}
          >
            <div style={{ width: BOT_CARD_W, height: BOT_CARD_H }}>
              <CardBack />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameTablePrototype() {
  const stackRef = useRef<HTMLDivElement>(null);
  const [tablePhase, setTablePhase] = useState<TablePhase>("pre");
  const [hands, setHands] = useState<Card[][] | null>(null);
  const [dealId, setDealId] = useState(0);

  const startGame = useCallback(() => {
    const deck = shuffleDeck(createDeck());
    setHands(dealFourHands(deck));
    setDealId((n) => n + 1);
    setTablePhase("dealing");
  }, []);

  const onPlayerDealComplete = useCallback(() => {
    setTablePhase("ready");
  }, []);

  const showTable = tablePhase !== "pre";
  const [, botLeft, botTop, botRight] = hands ?? [[], [], [], []];

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-green-950">
      <div
        className={`relative flex min-h-dvh flex-col transition-[filter,opacity] duration-300 ${
          tablePhase === "pre" ? "blur-sm" : ""
        }`}
      >
        {/* Table surface */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 45%, rgba(16, 185, 129, 0.25), transparent 70%)`,
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
                rotationDeg={180}
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
                rotationDeg={90}
                className="justify-self-start pl-1"
              />
            )}

            {/* Center stack + felt */}
            <div className="flex min-h-[140px] flex-col items-center justify-center gap-2">
              {showTable && (
                <div
                  ref={stackRef}
                  className="relative shrink-0 transition-transform duration-300"
                  style={{ width: STACK_CARD_W, height: STACK_CARD_H }}
                >
                  <div
                    style={{ width: STACK_CARD_W, height: STACK_CARD_H }}
                    className="absolute -top-1 -left-1 opacity-40 pointer-events-none"
                  >
                    <CardBack />
                  </div>
                  <div
                    style={{ width: STACK_CARD_W, height: STACK_CARD_H }}
                    className="absolute -top-0.5 -left-0.5 opacity-70 pointer-events-none"
                  >
                    <CardBack />
                  </div>
                  <div
                    style={{ width: STACK_CARD_W, height: STACK_CARD_H }}
                    className="relative shadow-lg"
                  >
                    <CardBack />
                  </div>
                </div>
              )}
            </div>

            {showTable && hands && (
              <BotHandStrip
                key={`bot-right-${dealId}`}
                stackRef={stackRef}
                cards={botRight}
                rotationDeg={-90}
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
                onDealComplete={onPlayerDealComplete}
                className="flex w-full flex-col items-center gap-3"
              />
            </div>
          )}
        </div>
      </div>

      {tablePhase === "pre" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <button
            type="button"
            onClick={startGame}
            className="rounded-full bg-white px-10 py-3 text-base font-semibold text-emerald-950 shadow-lg transition hover:bg-emerald-50 active:scale-[0.98]"
          >
            Start Game
          </button>
        </div>
      )}
    </div>
  );
}
