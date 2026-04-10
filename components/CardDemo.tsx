"use client";

import { useState, useEffect, useRef } from "react";
import { createDeck } from "@/lib/game/constants";
import type { Card, Rank, Suit } from "@/lib/game/types";
import { DEFAULT_RANK_ORDER, DEFAULT_RANK_SEQUENCE } from "@/lib/game/types";
import { CardFaceContent } from "@/components/cards/PlayingCard";
import { CardBack } from "@/components/cards/CardBack";
import { cardLabel } from "@/components/cards/suit-metadata";

const SUIT_ORDER: Record<Suit, number> = { D: 0, C: 1, H: 2, S: 3 };
const HAND_SIZE = 13;
const FLY_DURATION = 400;
const FLY_STAGGER = 50;
const FLIP_DURATION = 350;
const FLIP_STAGGER = 40;

// Card dimensions — SVG viewBox is 80×112, keep the same aspect ratio
const CARD_W = 96;
const CARD_H = Math.round(CARD_W * (112 / 80)); // 134
const CARD_OVERLAP = 16; // pixels hidden by the next card

type DealPhase = "idle" | "measuring" | "atStack" | "flying" | "flipping" | "done";

function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    // Sort by rank first (matches game/CLI), then suit as deterministic tie-break.
    const rankDiff = DEFAULT_RANK_ORDER[a.rank] - DEFAULT_RANK_ORDER[b.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
}

/** Lexicographic k-combinations of indices (indices sorted ascending). */
function combinations(indices: number[], k: number): number[][] {
  const n = indices.length;
  if (k < 0 || k > n) return [];
  if (k === 0) return [[]];
  const out: number[][] = [];
  const path: number[] = [];
  function dfs(start: number) {
    if (path.length === k) {
      out.push([...path]);
      return;
    }
    for (let j = start; j < n; j++) {
      path.push(indices[j]!);
      dfs(j + 1);
      path.pop();
    }
  }
  dfs(0);
  return out;
}

function buildChoiceSequences(cards: Card[]): {
  single: number[][];
  pair: number[][];
  triple: number[][];
  revolution: number[][];
} {
  const byRank = new Map<Rank, number[]>();
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i]!.rank;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(i);
  }

  const single: number[][] = cards.map((_, i) => [i]);
  const pair: number[][] = [];
  const triple: number[][] = [];
  const revolution: number[][] = [];

  for (const rank of DEFAULT_RANK_SEQUENCE) {
    const indices = byRank.get(rank);
    if (!indices || indices.length === 0) continue;
    if (indices.length >= 2) pair.push(...combinations(indices, 2));
    if (indices.length >= 3) triple.push(...combinations(indices, 3));
    if (indices.length >= 4) revolution.push(...combinations(indices, 4));
  }

  return { single, pair, triple, revolution };
}

type ChoiceKey = "single" | "pair" | "triple" | "revolution";

const INITIAL_CURSORS: Record<ChoiceKey, number> = {
  single: 0,
  pair: 0,
  triple: 0,
  revolution: 0,
};

export function CardDemo() {
  const [drawnCards, setDrawnCards] = useState<Card[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [choiceSequences, setChoiceSequences] = useState<{
    single: number[][];
    pair: number[][];
    triple: number[][];
    revolution: number[][];
  }>({ single: [], pair: [], triple: [], revolution: [] });
  const [choiceCursors, setChoiceCursors] =
    useState<Record<ChoiceKey, number>>(INITIAL_CURSORS);
  const [dealPhase, setDealPhase] = useState<DealPhase>("idle");
  const [drawId, setDrawId] = useState(0);

  const stackRef = useRef<HTMLDivElement>(null);
  const cardSlotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const flyOffsetsRef = useRef<{ x: number; y: number }[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  function drawDeck() {
    if (dealPhase !== "idle" && dealPhase !== "done") return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cardSlotsRef.current = [];
    setSelectedIndices(new Set());
    setChoiceCursors(INITIAL_CURSORS);

    const deck = shuffleDeck(createDeck());
    const cards = sortCards(deck.slice(0, HAND_SIZE));
    setDrawnCards(cards);
    setChoiceSequences(buildChoiceSequences(cards));
    setDrawId((n) => n + 1);
    setDealPhase("measuring");
  }

  function pickNextChoice(key: ChoiceKey) {
    const list = choiceSequences[key];
    setChoiceCursors((prev) => {
      const i = prev[key];
      if (i >= list.length) return prev;
      const indices = list[i]!;
      setSelectedIndices(new Set(indices));
      return { ...prev, [key]: i + 1 };
    });
  }

  // measuring → compute fly offsets → atStack
  useEffect(() => {
    if (dealPhase !== "measuring") return;
    if (!stackRef.current || drawnCards.length === 0) return;

    const sr = stackRef.current.getBoundingClientRect();
    const scx = sr.left + sr.width / 2;
    const scy = sr.top + sr.height / 2;

    flyOffsetsRef.current = cardSlotsRef.current.map((el) => {
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: scx - (r.left + r.width / 2),
        y: scy - (r.top + r.height / 2),
      };
    });

    setDealPhase("atStack");
  }, [dealPhase, drawnCards]);

  // atStack → double-rAF (guarantees a paint) → flying
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

  // flying → wait for last card to land → flipping
  useEffect(() => {
    if (dealPhase !== "flying") return;
    const t = setTimeout(
      () => setDealPhase("flipping"),
      (HAND_SIZE - 1) * FLY_STAGGER + FLY_DURATION + 50,
    );
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [dealPhase]);

  // flipping → wait for last card to flip → done
  useEffect(() => {
    if (dealPhase !== "flipping") return;
    const t = setTimeout(
      () => setDealPhase("done"),
      (HAND_SIZE - 1) * FLIP_STAGGER + FLIP_DURATION + 50,
    );
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [dealPhase]);

  function toggleSelection(index: number) {
    if (dealPhase !== "done") return;
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function getSlotStyle(index: number): React.CSSProperties {
    const offset = flyOffsetsRef.current[index] ?? { x: 0, y: 0 };

    switch (dealPhase) {
      case "measuring":
        return { opacity: 0 };
      case "atStack":
        return {
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          opacity: 1,
        };
      case "flying":
      case "flipping":
        return {
          transform: "translate(0, 0)",
          transition: `transform ${FLY_DURATION}ms ease-out ${index * FLY_STAGGER}ms`,
          opacity: 1,
        };
      case "done":
        return {
          transform: selectedIndices.has(index)
            ? "translateY(-20px)"
            : "translate(0, 0)",
          transition: "transform 150ms ease",
          opacity: 1,
        };
      default:
        return {};
    }
  }

  function getFlipStyle(index: number): React.CSSProperties {
    const shouldFlip = dealPhase === "flipping" || dealPhase === "done";
    return {
      transformStyle: "preserve-3d",
      transition: shouldFlip
        ? `transform ${FLIP_DURATION}ms ease-in-out ${index * FLIP_STAGGER}ms`
        : "none",
      transform: shouldFlip ? "rotateY(180deg)" : "rotateY(0deg)",
    };
  }

  const isAnimating = !["idle", "done"].includes(dealPhase);
  const canUseChoices = dealPhase === "done";
  const { single: singleChoices, pair: pairChoices, triple: tripleChoices, revolution: revolutionChoices } =
    choiceSequences;

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-12 w-full max-w-6xl mx-auto min-h-screen">
      <h1 className="text-white text-2xl font-semibold tracking-tight">
        Card Renderer
      </h1>

      <button
        onClick={drawDeck}
        disabled={isAnimating}
        className="px-6 py-2.5 text-sm font-medium text-black bg-white rounded-full transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed z-10 relative"
      >
        Draw Deck
      </button>

      {/* Center Stack */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{ height: CARD_H + 24 }}
      >
        <div
          ref={stackRef}
          className={`relative transition-transform duration-300 ${
            isAnimating ? "scale-95" : "scale-100"
          }`}
          style={{ width: CARD_W, height: CARD_H }}
        >
          <div
            style={{ width: CARD_W, height: CARD_H }}
            className="absolute -top-1 -left-1 opacity-40 pointer-events-none"
          >
            <CardBack />
          </div>
          <div
            style={{ width: CARD_W, height: CARD_H }}
            className="absolute -top-0.5 -left-0.5 opacity-70 pointer-events-none"
          >
            <CardBack />
          </div>
          <div style={{ width: CARD_W, height: CARD_H }} className="relative shadow-lg">
            <CardBack />
          </div>
        </div>
      </div>

      {/* Pattern pickers — lowest-first sequences per click (below deck) */}
      {drawnCards.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-4xl">
          {singleChoices.length > 0 && (
            <button
              type="button"
              onClick={() => pickNextChoice("single")}
              disabled={
                !canUseChoices ||
                choiceCursors.single >= singleChoices.length
              }
              className="px-4 py-2 text-sm font-medium text-black bg-white rounded-full transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Single
            </button>
          )}
          {pairChoices.length > 0 && (
            <button
              type="button"
              onClick={() => pickNextChoice("pair")}
              disabled={
                !canUseChoices || choiceCursors.pair >= pairChoices.length
              }
              className="px-4 py-2 text-sm font-medium text-black bg-white rounded-full transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pairs
            </button>
          )}
          {tripleChoices.length > 0 && (
            <button
              type="button"
              onClick={() => pickNextChoice("triple")}
              disabled={
                !canUseChoices ||
                choiceCursors.triple >= tripleChoices.length
              }
              className="px-4 py-2 text-sm font-medium text-black bg-white rounded-full transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Triples
            </button>
          )}
          {revolutionChoices.length > 0 && (
            <button
              type="button"
              onClick={() => pickNextChoice("revolution")}
              disabled={
                !canUseChoices ||
                choiceCursors.revolution >= revolutionChoices.length
              }
              className="px-4 py-2 text-sm font-medium text-black bg-white rounded-full transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Revolution
            </button>
          )}
        </div>
      )}

      {/* Hand */}
      <div
        className="flex items-end justify-center"
        style={{ minHeight: CARD_H + 20 }}
      >
        {drawnCards.length === 0 && dealPhase === "idle" && (
          <p className="text-zinc-600 text-sm">
            Click &apos;Draw Deck&apos; to start
          </p>
        )}
        {drawnCards.map((card, i) => {
          const isSelected = selectedIndices.has(i);
          return (
            <div
              key={`${drawId}-${i}`}
              ref={(el) => {
                cardSlotsRef.current[i] = el;
              }}
              onClick={() => toggleSelection(i)}
              className="cursor-pointer"
              style={{
                width: CARD_W,
                height: CARD_H,
                marginLeft: i === 0 ? 0 : -CARD_OVERLAP,
                zIndex: i,
                ...getSlotStyle(i),
              }}
              title={
                dealPhase === "done"
                  ? cardLabel(card.rank, card.suit)
                  : undefined
              }
            >
              {/* 3-D flip container */}
              <div
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  perspective: 900,
                }}
              >
                <div
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    position: "relative",
                    ...getFlipStyle(i),
                  }}
                >
                  {/* Back face */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: CARD_W,
                      height: CARD_H,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <CardBack />
                  </div>

                  {/* Front face — pre-rotated so it shows after flip */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: CARD_W,
                      height: CARD_H,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <svg
                      viewBox="0 0 80 112"
                      width={CARD_W}
                      height={CARD_H}
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ display: "block" }}
                    >
                      <CardFaceContent rank={card.rank} suit={card.suit} />
                    </svg>
                    {/* Selection ring overlay */}
                    {isSelected && dealPhase === "done" && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 6,
                          outline: "6px solid rgb(255, 255, 0)",
                          outlineOffset: 0,
                          pointerEvents: "none",
                          opacity: 0.45
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
