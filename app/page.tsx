import type { Metadata } from "next";
import { GameTablePrototype } from "@/components/GameTablePrototype";

export const metadata: Metadata = {
  title: "Table prototype",
  description: "Rough mobile card-table UI prototype",
};

export default function Home() {
  return <GameTablePrototype />;
}
