import type { Metadata } from "next";
import { GameTablePrototype } from "@/components/prototypes/GameTablePrototype";

export const metadata: Metadata = {
  title: "Tycoon",
  description: "Tycoon card game",
};

export default function Home() {
  return <GameTablePrototype />;
}
