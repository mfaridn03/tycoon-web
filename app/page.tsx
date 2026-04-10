import type { Metadata } from "next";
import { GameTablePrototype } from "@/components/GameTablePrototype";

export const metadata: Metadata = {
  title: "Table prototype",
  description: "Rough mobile card-table UI prototype",
};

export default function Home() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
      <GameTablePrototype />
    </div>
  );
}
