"use client";

import { useState } from "react";
import { createDeck } from "@/lib/game/constants";
import type { Card } from "@/lib/game/types";
import { PlayingCard, type SuitRenderMode } from "@/components/cards/PlayingCard";
import { CardBack } from "@/components/cards/CardBack";
import { cardLabel } from "@/components/cards/suit-metadata";

export function CardDemo() {
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [suitRenderMode, setSuitRenderMode] = useState<SuitRenderMode>("svg");

  function drawCard() {
    const deck = createDeck();
    setDrawnCard(deck[Math.floor(Math.random() * deck.length)]);
  }

  return (
    <div className="flex flex-col items-center gap-10 px-6">
      <h1 className="text-white text-2xl font-semibold tracking-tight">
        Card Renderer
      </h1>

      <button
        onClick={drawCard}
        className="px-6 py-2.5 text-sm font-medium text-black bg-white rounded-full transition-colors hover:bg-zinc-200 active:bg-zinc-300"
      >
        Draw Card
      </button>

      <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 p-1">
        <button
          onClick={() => setSuitRenderMode("svg")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            suitRenderMode === "svg"
              ? "bg-white text-black"
              : "text-zinc-400 hover:text-white"
          }`}
          aria-pressed={suitRenderMode === "svg"}
        >
          SVG + text
        </button>
        <button
          onClick={() => setSuitRenderMode("text")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            suitRenderMode === "text"
              ? "bg-white text-black"
              : "text-zinc-400 hover:text-white"
          }`}
          aria-pressed={suitRenderMode === "text"}
        >
          Text only
        </button>
      </div>

      <div className="min-h-36 flex items-center justify-center">
        {drawnCard ? (
          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-8 items-end">
              <div className="flex flex-col items-center gap-2">
                <div style={{ width: 96 }}>
                  <PlayingCard
                    rank={drawnCard.rank}
                    suit={drawnCard.suit}
                    suitRenderMode={suitRenderMode}
                  />
                </div>
                <span className="text-zinc-400 text-xs">
                  {cardLabel(drawnCard.rank, drawnCard.suit)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div style={{ width: 96 }}>
                  <CardBack />
                </div>
                <span className="text-zinc-400 text-xs">Card back</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-zinc-600 text-sm">Click to draw a card</p>
        )}
      </div>
    </div>
  );
}
