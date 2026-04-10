"use client";

import { useState } from "react";
import { createDeck } from "@/lib/game/constants";
import type { Card } from "@/lib/game/types";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { CardBack } from "@/components/cards/CardBack";
import { cardLabel } from "@/components/cards/suit-metadata";

function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function CardDemo() {
  const [drawnCards, setDrawnCards] = useState<Card[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isDrawing, setIsDrawing] = useState(false);
  const [stackRemainingCount, setStackRemainingCount] = useState<number>(52);
  const [showDeckCards, setShowDeckCards] = useState(false);

  function drawDeck() {
    if (isDrawing) return;
    setIsDrawing(true);
    setShowDeckCards(false);
    setSelectedIndices(new Set());

    // Briefly wait to allow exit animation if cards were already shown
    setTimeout(() => {
      const deck = shuffleDeck(createDeck());
      setDrawnCards(deck.slice(0, 13));
      setStackRemainingCount(52 - 13);
      setShowDeckCards(true);

      // Finish drawing state after the stagger animation completes
      setTimeout(() => {
        setIsDrawing(false);
      }, 600);
    }, drawnCards.length > 0 ? 300 : 0);
  }

  function toggleSelection(index: number) {
    if (isDrawing) return;
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col items-center gap-10 px-6 py-12 w-full max-w-6xl mx-auto min-h-screen">
      <h1 className="text-white text-2xl font-semibold tracking-tight">
        Card Renderer
      </h1>

      <button
        onClick={drawDeck}
        disabled={isDrawing}
        className="px-6 py-2.5 text-sm font-medium text-black bg-white rounded-full transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed z-10 relative"
      >
        Draw Deck
      </button>

      {/* Center Stack Area */}
      <div className="relative h-40 w-full flex items-center justify-center">
        {stackRemainingCount > 0 ? (
          <div
            className={`relative transition-all duration-500 ease-out ${
              isDrawing && !showDeckCards ? "scale-95 opacity-80" : "scale-100 opacity-100"
            }`}
          >
            {/* Stack visual: offset a few card backs */}
            <div style={{ width: 96 }} className="absolute -top-1 -left-1 opacity-50 pointer-events-none">
              <CardBack />
            </div>
            <div style={{ width: 96 }} className="absolute -top-0.5 -left-0.5 opacity-80 pointer-events-none">
              <CardBack />
            </div>
            <div style={{ width: 96 }} className="relative shadow-xl">
              <CardBack />
            </div>
            
            <div className="absolute -bottom-8 left-0 right-0 text-center">
              <span className="text-zinc-500 text-xs font-medium">
                {stackRemainingCount} cards
              </span>
            </div>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <span className="text-zinc-600 text-sm">Click 'Draw Deck' to start</span>
          </div>
        )}
      </div>

      {/* Drawn Cards Hand */}
      <div className="w-full flex flex-wrap justify-center gap-3 sm:gap-4 mt-4 px-4 min-h-[160px]">
        {drawnCards.map((card, index) => {
          const isSelected = selectedIndices.has(index);
          return (
            <div
              key={`${card.rank}-${card.suit}-${index}`}
              onClick={() => toggleSelection(index)}
              className={`transition-all duration-500 ease-out cursor-pointer ${
                showDeckCards
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                width: 80,
                transitionDelay: showDeckCards ? `${index * 30}ms` : "0ms",
              }}
              title={cardLabel(card.rank, card.suit)}
            >
              <PlayingCard 
                rank={card.rank} 
                suit={card.suit} 
                selected={isSelected} 
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
