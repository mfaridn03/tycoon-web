"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  type RefObject,
} from "react";
import { createDeck } from "@/lib/game/core/constants";
import { shuffleDeck } from "@/lib/game/utils/shuffle-deck";
import { sortPlayerHand } from "@/lib/game/utils/sort-player-hand";
import type { Card, LegalPlay, Rank } from "@/lib/game/core/types";
import { CardFaceContent } from "@/components/cards/PlayingCard";
import { CardBack } from "@/components/cards/CardBack";
import { cardLabel } from "@/components/cards/suit-metadata";

/** 54-card deck → two players get 14, so max hand size is 14. */
const MAX_HAND_SIZE = 14;
const FLY_DURATION = 400;
const FLY_STAGGER = 50;
const FLIP_DURATION = 350;
const FLIP_STAGGER = 40;
const PLAY_MODE_BAR_MIN_H = 68;

// Card dimensions — SVG viewBox is 80×112, keep the same aspect ratio
const CARD_W = 96;
const CARD_H = Math.round(CARD_W * (112 / 80)); // 134
const CARD_OVERLAP = 16; // pixels hidden by the next card
const CARD_STEP = CARD_W - CARD_OVERLAP;
const INTERACTIVE_SELECTOR = "[data-card-demo-interactive='true']";

type DealPhase = "idle" | "measuring" | "atStack" | "flying" | "flipping" | "done";

export type CardDemoPlayMode = {
  canPass: boolean;
  onPlay: (cards: Card[], wildcardRank?: Rank) => void;
  onPass: () => void;
  playError?: string | null;
};

export type CardDemoTradeMode = {
  pickCount: number;
  onConfirm: (cards: Card[]) => void;
  error?: string | null;
};

export type CardDemoProps = {
  variant?: "standalone" | "embedded";
  /** When set, fly animation measures from this stack (parent renders the stack). */
  externalStackRef?: RefObject<HTMLDivElement | null>;
  /** Pre-dealt player hand; embedded mount starts deal when length is 13. */
  playerCards?: Card[] | null;
  /** Legal plays for current turn. Cards not in any legal play are greyed out. */
  legalPlays?: LegalPlay[] | null;
  className?: string;
  onDealComplete?: () => void;
  /** After initial deal, sync hand from parent without re-deal animation (shedding). */
  gameHandSync?: boolean;
  /** Replaces demo pattern pickers with Pass / Play selected. */
  playMode?: CardDemoPlayMode | null;
  /** Trade phase: pick exactly N cards then confirm. */
  tradeMode?: CardDemoTradeMode | null;
  /** Shown in embedded mode between the play/trade bar and the hand (e.g. previous-round rank). */
  playerRankLabel?: string | null;
};

export function CardDemo({
  variant = "standalone",
  externalStackRef,
  playerCards,
  legalPlays = null,
  className,
  onDealComplete,
  gameHandSync = false,
  playMode = null,
  tradeMode = null,
  playerRankLabel = null,
}: CardDemoProps) {
  const [drawnCards, setDrawnCards] = useState<Card[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [selectedJokerRank, setSelectedJokerRank] = useState<string>("JK");
  const selectedIndicesRef = useRef(selectedIndices);
  selectedIndicesRef.current = selectedIndices;
  const [dealPhase, setDealPhase] = useState<DealPhase>("idle");
  const [drawId, setDrawId] = useState(0);
  const [flyOffsets, setFlyOffsets] = useState<{ x: number; y: number }[]>(
    [],
  );

  const internalStackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stackRef = externalStackRef ?? internalStackRef;
  const cardSlotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const exitFadeFrameRef = useRef<number | null>(null);
  const drawnCardsRef = useRef<Card[]>([]);
  drawnCardsRef.current = drawnCards;
  const [exitingCards, setExitingCards] = useState<
    { card: Card; index: number; handSize: number }[]
  >([]);
  const [exitingCardsFading, setExitingCardsFading] = useState(false);

  /**
   * Set of card indices that appear in at least one legal play.
   * null  → no filtering (not in playMode or legalPlays not provided).
   * empty → every card is greyed out (no legal plays exist).
   */
  const legalCardIndices = useMemo<Set<number> | null>(() => {
    if (!playMode || legalPlays === null) return null;
    const indexByKey = new Map<string, number>();
    drawnCards.forEach((card, i) => {
      indexByKey.set(`${card.rank}:${card.suit}`, i);
    });
    const set = new Set<number>();
    for (const lp of legalPlays) {
      for (const card of lp.cards) {
        const idx = indexByKey.get(`${card.rank}:${card.suit}`);
        if (idx !== undefined) set.add(idx);
      }
    }
    return set;
  }, [playMode, legalPlays, drawnCards]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      if (exitFadeFrameRef.current !== null) {
        cancelAnimationFrame(exitFadeFrameRef.current);
      }
    },
    [],
  );

  function beginDealWithCards(cards: Card[]) {
    if (dealPhase !== "idle" && dealPhase !== "done") return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cardSlotsRef.current = [];
    setFlyOffsets([]);
    setSelectedIndices(new Set());

    const sorted = sortPlayerHand(cards);
    setDrawnCards(sorted);
    setDrawId((n) => n + 1);
    setDealPhase("measuring");
  }

  function drawDeck() {
    const deck = shuffleDeck(createDeck());
    beginDealWithCards(deck.slice(0, MAX_HAND_SIZE));
  }

  useLayoutEffect(() => {
    if (variant !== "embedded") return;
    if (!playerCards || playerCards.length < 13 || playerCards.length > 14) return;
    // After first deal, parent uses `gameHandSync` to apply hand updates (e.g. post-trade).
    // Re-running the full deal here would leave `dealPhase` stuck in "measuring" when the
    // center stack is unmounted during play (`externalStackRef` null), so hand vanishes.
    if (gameHandSync) return;
    beginDealWithCards(playerCards);
    // Intentionally run when variant/playerCards change (parent remount + stable hand).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- beginDealWithCards closes over fresh deal state
  }, [variant, playerCards, gameHandSync]);

  useEffect(() => {
    if (variant !== "embedded" || !gameHandSync || !playerCards) return;
    if (dealPhase !== "done") return;

    const newSorted = sortPlayerHand(playerCards);
    const current = drawnCardsRef.current;
    const newKeys = new Set(newSorted.map((c) => `${c.rank}:${c.suit}`));
    const exiting = current
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !newKeys.has(`${card.rank}:${card.suit}`))
      .map(({ card, index }) => ({ card, index }));

    if (exiting.length > 0) {
      setExitingCards(
        exiting.map(({ card, index }) => ({
          card,
          index,
          handSize: current.length,
        })),
      );
      setExitingCardsFading(false);
      setSelectedIndices(new Set());
      setDrawnCards(newSorted);
      if (exitFadeFrameRef.current !== null) {
        cancelAnimationFrame(exitFadeFrameRef.current);
      }
      exitFadeFrameRef.current = requestAnimationFrame(() => {
        setExitingCardsFading(true);
        exitFadeFrameRef.current = null;
      });
      const t = setTimeout(() => {
        setExitingCards([]);
        setExitingCardsFading(false);
      }, 320);
      timersRef.current.push(t);
    } else {
      setDrawnCards(newSorted);
      setSelectedIndices(new Set());
    }
  }, [playerCards, gameHandSync, dealPhase, variant]);

  const clearSelectionAndResetChoices = useCallback(() => {
    if (selectedIndicesRef.current.size === 0) return;
    setSelectedIndices(new Set());
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      clearSelectionAndResetChoices();
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [clearSelectionAndResetChoices]);

  // measuring → compute fly offsets → atStack
  useEffect(() => {
    if (dealPhase !== "measuring") return;
    if (!stackRef.current || drawnCards.length === 0) return;

    const sr = stackRef.current.getBoundingClientRect();
    const scx = sr.left + sr.width / 2;
    const scy = sr.top + sr.height / 2;

    const offsets = cardSlotsRef.current.map((el) => {
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: scx - (r.left + r.width / 2),
        y: scy - (r.top + r.height / 2),
      };
    });
    setFlyOffsets(offsets);

    setDealPhase("atStack");
  }, [dealPhase, drawnCards, stackRef]);

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
      (MAX_HAND_SIZE - 1) * FLY_STAGGER + FLY_DURATION + 50,
    );
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [dealPhase]);

  // flipping → wait for last card to flip → done
  useEffect(() => {
    if (dealPhase !== "flipping") return;
    const t = setTimeout(
      () => setDealPhase("done"),
      (MAX_HAND_SIZE - 1) * FLIP_STAGGER + FLIP_DURATION + 50,
    );
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [dealPhase]);

  const notifiedDealDoneRef = useRef(false);
  useEffect(() => {
    if (dealPhase !== "done") {
      notifiedDealDoneRef.current = false;
      return;
    }
    if (notifiedDealDoneRef.current) return;
    notifiedDealDoneRef.current = true;
    onDealComplete?.();
  }, [dealPhase, onDealComplete]);

  // Reset joker rank choice when selection changes
  useEffect(() => {
    setSelectedJokerRank("JK");
  }, [selectedIndices]);

  // When it's not our turn anymore, clear selection (prevents stale highlight).
  useEffect(() => {
    if (playMode || tradeMode) return;
    setSelectedIndices(new Set());
  }, [playMode, tradeMode]);

  function toggleSelection(index: number) {
    if (dealPhase !== "done") return;
    if (!playMode && !tradeMode) return;
    if (playMode && legalCardIndices !== null && !legalCardIndices.has(index)) return;
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function getSlotStyle(index: number): React.CSSProperties {
    const handOffset = (index - (drawnCards.length - 1) / 2) * CARD_STEP;
    const baseTransform = `translateX(${handOffset}px)`;

    const offset = flyOffsets[index] ?? { x: 0, y: 0 };

    switch (dealPhase) {
      case "measuring":
        return { opacity: 0 };
      case "atStack":
        return {
          transform: `${baseTransform} translate(${offset.x}px, ${offset.y}px)`,
          opacity: 1,
        };
      case "flying":
      case "flipping":
        return {
          transform: `${baseTransform} translate(0, 0)`,
          transition: `transform ${FLY_DURATION}ms ease-out ${index * FLY_STAGGER}ms`,
          opacity: 1,
        };
      case "done":
        return {
          transform: `${baseTransform} ${
            selectedIndices.has(index) ? "translateY(-20px)" : "translateY(0)"
          }`,
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
  const showPlayModeBar = canUseChoices && playMode;
  const showTradeModeBar = canUseChoices && tradeMode;
  const reservePlayModeBarSpace = variant === "embedded" || showPlayModeBar || showTradeModeBar;

  const showOwnStack = variant === "standalone" || !externalStackRef;
  const rootClass =
    variant === "embedded"
      ? className ?? "flex flex-col items-center gap-4 w-full px-1 pb-2"
      : [
          "flex flex-col items-center gap-8 px-6 py-12 w-full max-w-6xl mx-auto min-h-screen",
          className,
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClass}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.closest(INTERACTIVE_SELECTOR)) {
          clearSelectionAndResetChoices();
        }
      }}
    >
      {variant === "standalone" && (
        <h1 className="text-white text-2xl font-semibold tracking-tight">
          Card Renderer
        </h1>
      )}

      {variant === "standalone" && (
        <button
          onClick={drawDeck}
          disabled={isAnimating}
          data-card-demo-interactive="true"
          className="px-6 py-2.5 text-sm font-medium text-black bg-white rounded-full transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed z-10 relative"
        >
          Draw Deck
        </button>
      )}

      {/* Center Stack — standalone only; embedded uses parent stack via externalStackRef */}
      {showOwnStack && (
        <div
          className="relative w-full flex items-center justify-center"
          style={{ height: CARD_H + 24 }}
        >
          <div
            ref={internalStackRef}
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
      )}

      {reservePlayModeBarSpace && (
        <div
          className="flex w-full max-w-4xl flex-col items-center justify-start gap-2"
          style={{ minHeight: PLAY_MODE_BAR_MIN_H }}
        >
          {showTradeModeBar && tradeMode ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const idxs = [...selectedIndices].sort((a, b) => a - b);
                    const cards = idxs.map((i) => drawnCards[i]!);
                    tradeMode.onConfirm(cards);
                    setSelectedIndices(new Set());
                  }}
                  disabled={selectedIndices.size !== tradeMode.pickCount}
                  data-card-demo-interactive="true"
                  className="rounded-full bg-yellow-400 px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-yellow-300 active:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm trade ({selectedIndices.size}/{tradeMode.pickCount})
                </button>
              </div>
              <div className="min-h-4">
                {tradeMode.error ? (
                  <p className="text-center text-xs text-red-300">{tradeMode.error}</p>
                ) : null}
              </div>
            </>
          ) : showPlayModeBar && playMode ? (
            (() => {
              const selCards = [...selectedIndices].sort((a, b) => a - b).map(i => drawnCards[i]!);
              const allJokers = selCards.length > 0 && selCards.every(c => c.isJoker());

              // Compute available wildcard ranks for the selected joker cards
              const jokerRankOptions: (Rank | undefined)[] = [];
              if (allJokers && legalPlays) {
                const selKeys = new Set(selCards.map(c => `${c.rank}:${c.suit}`));
                const matching = legalPlays.filter(lp => {
                  if (lp.cards.length !== selCards.length) return false;
                  const lpKeys = new Set(lp.cards.map(c => `${c.rank}:${c.suit}`));
                  for (const k of selKeys) { if (!lpKeys.has(k)) return false; }
                  return true;
                });
                const seen = new Set<string>();
                for (const lp of matching) {
                  const key = lp.wildcardRank ?? "JK";
                  if (!seen.has(key)) {
                    seen.add(key);
                    jokerRankOptions.push(lp.wildcardRank);
                  }
                }
              }
              const showJokerDropdown = allJokers && jokerRankOptions.length > 1;

              return (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {playMode.canPass && (
                      <button
                        type="button"
                        onClick={() => playMode.onPass()}
                        data-card-demo-interactive="true"
                        className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-white active:bg-zinc-300"
                      >
                        Pass
                      </button>
                    )}
                    {showJokerDropdown && (
                      <select
                        value={selectedJokerRank}
                        onChange={(e) => setSelectedJokerRank(e.target.value)}
                        data-card-demo-interactive="true"
                        className="rounded-full bg-zinc-800 px-3 py-2 text-sm font-medium text-white ring-1 ring-zinc-600 transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        {jokerRankOptions.map((r) => (
                          <option key={r ?? "JK"} value={r ?? "JK"}>
                            {r ? `Play as ${r}` : "Joker"}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const cards = selCards;
                        let wildcardRank: Rank | undefined;
                        if (allJokers && selectedJokerRank !== "JK") {
                          wildcardRank = selectedJokerRank as Rank;
                        } else if (!allJokers && legalPlays) {
                          const cardKeys = new Set(cards.map(c => `${c.rank}:${c.suit}`));
                          const match = legalPlays.find(lp => {
                            if (lp.cards.length !== cards.length) return false;
                            const lpKeys = new Set(lp.cards.map(c => `${c.rank}:${c.suit}`));
                            for (const k of cardKeys) { if (!lpKeys.has(k)) return false; }
                            return true;
                          });
                          wildcardRank = match?.wildcardRank;
                        }
                        playMode.onPlay(cards, wildcardRank);
                      }}
                      disabled={selectedIndices.size === 0}
                      data-card-demo-interactive="true"
                      className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-100 active:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Play selected
                    </button>
                  </div>
                  <div className="min-h-4">
                    {playMode.playError ? (
                      <p className="text-center text-xs text-red-300">{playMode.playError}</p>
                    ) : null}
                  </div>
                </>
              );
            })()
          
          ) : (
            <div aria-hidden="true" className="invisible flex w-full flex-col items-center gap-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  className="rounded-full px-5 py-2 text-sm font-medium"
                >
                  Pass
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  className="rounded-full px-5 py-2 text-sm font-medium"
                >
                  Play selected
                </button>
              </div>
              <div className="min-h-4 text-center text-xs">placeholder</div>
            </div>
          )}
        </div>
      )}

      {variant === "embedded" && playerRankLabel ? (
        <p className="text-center text-sm font-medium tracking-wide text-emerald-200/95">
          ({playerRankLabel})
        </p>
      ) : null}

      {/* Hand */}
      <div
        className="flex items-end justify-center"
        style={{ minHeight: CARD_H + 20 }}
      >
        {variant === "standalone" &&
          drawnCards.length === 0 &&
          dealPhase === "idle" && (
            <p className="text-zinc-600 text-sm">
              Click &apos;Draw Deck&apos; to start
            </p>
          )}
        {drawnCards.length > 0 && (
          <div className="relative w-full overflow-visible" style={{ height: CARD_H }}>
            {exitingCards.map(({ card, index, handSize }) => {
              const handOffset = (index - (handSize - 1) / 2) * CARD_STEP;
              const baseTransform = `translateX(${handOffset}px)`;
              return (
                <div
                  key={`exit-${drawId}-${card.rank}:${card.suit}`}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    width: CARD_W,
                    height: CARD_H,
                    zIndex: index,
                    transform: `${baseTransform} translateY(-18px)`,
                    opacity: exitingCardsFading ? 0 : 1,
                    transition: "transform 280ms ease-out, opacity 260ms ease-out",
                    pointerEvents: "none",
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
                </div>
              );
            })}
            {drawnCards.map((card, i) => {
              const isSelected = selectedIndices.has(i);
              const isGreyed =
                !playMode && !tradeMode ||
                (playMode && legalCardIndices !== null && !legalCardIndices.has(i));
              return (
                <div
                  key={`${drawId}-${card.rank}:${card.suit}`}
                  ref={(el) => {
                    cardSlotsRef.current[i] = el;
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSelection(i);
                  }}
                  data-card-demo-interactive="true"
                  className={isGreyed ? "cursor-not-allowed" : "cursor-pointer"}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    width: CARD_W,
                    height: CARD_H,
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
                              opacity: 0.45,
                            }}
                          />
                        )}
                        {/* Grey overlay for non-legal cards */}
                        {isGreyed && dealPhase === "done" && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: 6,
                              backgroundColor: "rgba(0, 0, 0, 0.55)",
                              pointerEvents: "none",
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
        )}
      </div>
    </div>
  );
}
