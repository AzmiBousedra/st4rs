// app/page.tsx
"use client"

import { useState } from "react"
import GalaxyCanvas from "@/components/GalaxyCanvas"
import { ConstellationCanvas } from "@/components/ConstellationCanvas"

type ViewMode = "galaxy" | "constellation"

export default function HomePage() {
  const [mode, setMode] = useState<ViewMode>("galaxy")

  const toggleMode = () => {
    setMode((prev) =>
      prev === "galaxy" ? "constellation" : "galaxy"
    )
  }

  const isGalaxy = mode === "galaxy"

  return (
    <main className="w-screen h-screen relative overflow-hidden">
      {/* top left toggle */}
      <button
        onClick={toggleMode}
        className="absolute top-4 left-4 z-20 rounded-full border border-white/40 bg-black/70 text-white px-4 py-1 text-xs md:text-sm backdrop-blur-sm hover:bg-white hover:text-black transition-colors"
      >
        {isGalaxy ? "Go to constellation" : "Back to space"}
      </button>

      <div className="w-full h-full">
        {isGalaxy ? <GalaxyCanvas /> : <ConstellationCanvas />}
      </div>
    </main>
  )
}
