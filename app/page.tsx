import type { Metadata } from "next";
import { CardDemo } from "@/components/CardDemo";

export const metadata: Metadata = {
  title: "Card Demo",
  description: "SVG playing card renderer",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <CardDemo />
    </div>
  );
}
