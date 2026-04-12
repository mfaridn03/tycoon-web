"use client";

import { useSyncExternalStore } from "react";

const HAND_SIZE = 14;
const CENTER_ZONE_MAX_CARDS = 4;
const CARD_ASPECT = 112 / 80;

/** Base design tokens at scale 1 (desktop). */
const BASE = {
  stackCardW: 96,
  playCardW: 72,
  playZoneDy: 72,
  playZoneDx: 110,
  botCardW: 32,
  botOverlap: 24,
  playOriginTranslate: 60,
  centerMinH: 220,
  playModeBarMinH: 68,
  cardW: 96,
  cardOverlap: 16,
  faceUpGap: 4,
  labelShiftX: 50,
  labelShiftY: 20,
  botStripPad: 8,
  stackExtraH: 18,
  /** Gap between face-up play SVGs. */
  centerZoneGap: 4,
} as const;

export type GameTableLayout = {
  scale: number;
  stackCardW: number;
  stackCardH: number;
  stackExtraHeight: number;
  playCardW: number;
  playCardH: number;
  playZoneOffsets: Record<number, [number, number]>;
  playOrigins: Record<number, string>;
  botCardW: number;
  botCardH: number;
  botOverlap: number;
  botStripStep: number;
  botStripW: number;
  centerZoneW: number;
  centerZoneH: number;
  centerMinH: number;
  faceUpGap: number;
  labelShiftX: number;
  labelShiftY: number;
  botStripMinHeightPad: number;
  stackLayerTopUnit: number;
  stackLayerLeftUnit: number;
  /** Human hand + embedded bar (CardDemo). */
  cardW: number;
  cardH: number;
  cardOverlap: number;
  cardStep: number;
  playModeBarMinH: number;
  selectionLiftPx: number;
};

function roundScale(scale: number, n: number): number {
  return Math.max(1, Math.round(n * scale));
}

const DEFAULT_SERVER_LAYOUT = computeGameTableLayout(1024, 768);

let cachedViewportWidth = 1024;
let cachedViewportHeight = 768;
let cachedLayout = DEFAULT_SERVER_LAYOUT;

/**
 * Responsive scale: shrink on narrow or short viewports.
 * Landscape keeps current reference. Portrait uses a wider reference width
 * and lower floor so table shrinks earlier on phones.
 */
export function computeGameTableLayout(
  viewportWidth: number,
  viewportHeight: number,
): GameTableLayout {
  const isPortrait = viewportHeight >= viewportWidth;
  const referenceWidth = isPortrait ? 500 : 430;
  const minScale = isPortrait ? 0.56 : 0.65;
  const raw = Math.min(viewportWidth / referenceWidth, viewportHeight / 750);
  const scale = Math.min(1, Math.max(minScale, raw));

  const stackCardW = roundScale(scale, BASE.stackCardW);
  const stackCardH = Math.round(stackCardW * CARD_ASPECT);
  const playCardW = roundScale(scale, BASE.playCardW);
  const playCardH = Math.round(playCardW * CARD_ASPECT);
  const botCardW = roundScale(scale, BASE.botCardW);
  const botCardH = Math.round(botCardW * CARD_ASPECT);
  const botOverlap = roundScale(scale, BASE.botOverlap);
  const botStripStep = botCardW - botOverlap;
  const botStripW = botCardW + (HAND_SIZE - 1) * botStripStep;

  const dy = roundScale(scale, BASE.playZoneDy);
  const dx = roundScale(scale, BASE.playZoneDx);
  const t = roundScale(scale, BASE.playOriginTranslate);

  const zoneGap = Math.max(2, Math.round(BASE.centerZoneGap * scale));
  const centerZoneW =
    playCardW * CENTER_ZONE_MAX_CARDS +
    zoneGap * (CENTER_ZONE_MAX_CARDS - 1);
  const centerZoneH = Math.round(playCardH * 1.6);

  const cardW = roundScale(scale, BASE.cardW);
  const cardH = Math.round(cardW * CARD_ASPECT);
  const cardOverlap = roundScale(scale, BASE.cardOverlap);
  const cardStep = cardW - cardOverlap;

  return {
    scale,
    stackCardW,
    stackCardH,
    stackExtraHeight: roundScale(scale, BASE.stackExtraH),
    playCardW,
    playCardH,
    playZoneOffsets: {
      0: [0, dy],
      1: [-dx, 0],
      2: [0, -dy],
      3: [dx, 0],
    },
    playOrigins: {
      0: `translateY(${t}px)`,
      1: `translateX(-${t}px)`,
      2: `translateY(-${t}px)`,
      3: `translateX(${t}px)`,
    },
    botCardW,
    botCardH,
    botOverlap,
    botStripStep,
    botStripW,
    centerZoneW,
    centerZoneH,
    centerMinH: Math.max(140, Math.round(BASE.centerMinH * scale)),
    faceUpGap: Math.max(2, Math.round(BASE.faceUpGap * scale)),
    labelShiftX: roundScale(scale, BASE.labelShiftX),
    labelShiftY: roundScale(scale, BASE.labelShiftY),
    botStripMinHeightPad: Math.max(4, Math.round(BASE.botStripPad * scale)),
    stackLayerTopUnit: Math.max(0.5, 1.1 * scale),
    stackLayerLeftUnit: Math.max(0.5, 0.8 * scale),
    cardW,
    cardH,
    cardOverlap,
    cardStep,
    playModeBarMinH: Math.max(48, Math.round(BASE.playModeBarMinH * scale)),
    selectionLiftPx: Math.max(12, Math.round(20 * scale)),
  };
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function getSnapshot(): GameTableLayout {
  if (typeof window === "undefined") {
    return DEFAULT_SERVER_LAYOUT;
  }

  const { innerWidth, innerHeight } = window;
  if (innerWidth === cachedViewportWidth && innerHeight === cachedViewportHeight) {
    return cachedLayout;
  }

  cachedViewportWidth = innerWidth;
  cachedViewportHeight = innerHeight;
  cachedLayout = computeGameTableLayout(innerWidth, innerHeight);
  return cachedLayout;
}

function getServerSnapshot(): GameTableLayout {
  return DEFAULT_SERVER_LAYOUT;
}

export function useGameLayout(): GameTableLayout {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
