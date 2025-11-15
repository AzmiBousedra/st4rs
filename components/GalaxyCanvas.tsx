"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import { useRef, useState } from "react"
import * as THREE from "three"
import { StarField, StarSelectionInfo } from "./StarField"

type SpectralClass = "O" | "B" | "A" | "F" | "G" | "K" | "M"

type CatalogStar = {
  name: string | null
  mag: number
  spect: string | null
  x: number
  y: number
  z: number
}

const SPECTRAL_CONFIG: Record<
  SpectralClass,
  {
    tempRange: [number, number]
    radiusRangeSun: [number, number]
    label: string
  }
> = {
  O: {
    tempRange: [30000, 50000],
    radiusRangeSun: [6, 10],
    label: "O-type blue star",
  },
  B: {
    tempRange: [10000, 30000],
    radiusRangeSun: [2, 6],
    label: "B-type blue white star",
  },
  A: {
    tempRange: [7500, 10000],
    radiusRangeSun: [1.4, 2.0],
    label: "A-type white star",
  },
  F: {
    tempRange: [6000, 7500],
    radiusRangeSun: [1.15, 1.4],
    label: "F-type yellow white star",
  },
  G: {
    tempRange: [5200, 6000],
    radiusRangeSun: [0.9, 1.15],
    label: "G-type yellow star",
  },
  K: {
    tempRange: [3700, 5200],
    radiusRangeSun: [0.7, 0.9],
    label: "K-type orange star",
  },
  M: {
    tempRange: [2400, 3700],
    radiusRangeSun: [0.1, 0.7],
    label: "M-type red dwarf",
  },
}

function randInRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function inferSpectralClassFromCatalog(
  star: CatalogStar
): SpectralClass {
  const raw = (star.spect || "").trim()
  if (raw.length > 0) {
    const c = raw[0].toUpperCase()
    if (c === "O" || c === "B" || c === "A" || c === "F" || c === "G" || c === "K" || c === "M") {
      return c
    }
  }

  const m = star.mag
  if (m <= 0.0) return "B"
  if (m <= 1.5) return "A"
  if (m <= 3.0) return "F"
  if (m <= 4.5) return "G"
  if (m <= 6.0) return "K"
  return "M"
}

// helper to focus camera in a consistent way around a given position
function focusCameraOn(
  controls: any,
  position: THREE.Vector3,
  distance = 30
) {
  const cam = controls.object as THREE.PerspectiveCamera

  // orbit target is exactly at the star
  controls.target.copy(position)

  // camera offset: always same local offset relative to star
  const offset = new THREE.Vector3(0, 0, distance)
  cam.position.copy(position.clone().add(offset))

  controls.update()
}

export default function GalaxyCanvas() {
  const [selectedStar, setSelectedStar] =
    useState<StarSelectionInfo | null>(null)
  const [searchValue, setSearchValue] = useState("")

  const controlsRef = useRef<any>(null)

  const handleStarSelect = (info: StarSelectionInfo) => {
    setSelectedStar(info)

    const controls = controlsRef.current
    if (controls) {
      const pos = new THREE.Vector3(
        info.position[0],
        info.position[1],
        info.position[2]
      )
      focusCameraOn(controls, pos, 30)
    }
  }

  const handleVoidClick = () => {
    setSelectedStar(null)

    const controls = controlsRef.current
    if (controls) {
      controls.target.set(0, 0, 0)
      const cam = controls.object as THREE.PerspectiveCamera
      cam.position.set(0, 0, 120)
      controls.update()
    }
  }

  const performSearch = async () => {
    if (!searchValue.trim()) return

    const stars = (await import("../data/stars.json"))
      .default as CatalogStar[]

    const targetStar = stars.find(
      (s) =>
        s.name &&
        s.name.toLowerCase() === searchValue.toLowerCase()
    )

    if (!targetStar) {
      console.warn("Star not found:", searchValue)
      return
    }

    const spectralClass =
      inferSpectralClassFromCatalog(targetStar)
    const cfg = SPECTRAL_CONFIG[spectralClass]

    const temperature = Math.round(
      randInRange(cfg.tempRange[0], cfg.tempRange[1])
    )
    const radiusSun = randInRange(
      cfg.radiusRangeSun[0],
      cfg.radiusRangeSun[1]
    )

    // we do not know the exact remapped position from StarField here,
    // so we use a synthetic but stable focus position per star:
    const dir = new THREE.Vector3(
      targetStar.x,
      targetStar.y,
      targetStar.z
    )
    if (dir.length() === 0) dir.set(0, 0, 1)
    dir.normalize()

    const focusDistance = 50
    const pos = dir.clone().multiplyScalar(focusDistance)

    const info: StarSelectionInfo = {
      position: [pos.x, pos.y, pos.z],
      name: targetStar.name || "Unnamed star",
      status: "unclaimed",
      type: cfg.label,
      temperature,
      size: `${radiusSun.toFixed(2)} x Sun radius`,
    }

    setSelectedStar(info)

    const controls = controlsRef.current
    if (controls) {
      focusCameraOn(controls, pos, 30)
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* Search bar */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 10,
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") performSearch()
          }}
          placeholder="Search star name…"
          style={{
            padding: "6px 10px",
            borderRadius: "4px",
            border: "1px solid #555",
            background: "#111",
            color: "#fff",
            width: "200px",
          }}
        />
        <button
          onClick={performSearch}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            background: "#333",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Go
        </button>
      </div>

      {/* Info box */}
      {selectedStar && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            zIndex: 10,
            background: "rgba(0,0,0,0.65)",
            padding: "14px 20px",
            borderRadius: "6px",
            color: "white",
            width: "260px",
            fontSize: "14px",
          }}
        >
          <div>
            <b>Name:</b> {selectedStar.name}
          </div>
          <div>
            <b>Status:</b> {selectedStar.status}
          </div>
          <div>
            <b>Type:</b> {selectedStar.type}
          </div>
          <div>
            <b>Temperature:</b> {selectedStar.temperature} K
          </div>
          <div>
            <b>Size:</b> {selectedStar.size}
          </div>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 0, 120], fov: 55 }}
        onPointerMissed={handleVoidClick}
      >
        <color attach="background" args={["#000000"]} />

        <EffectComposer>
          <Bloom
            intensity={1.6}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.3}
            radius={0.9}
          />
        </EffectComposer>

        <StarField
  onStarSelect={handleStarSelect}
  selectedName={selectedStar?.name ?? null}
/>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          minDistance={5}
          maxDistance={400}
        />
      </Canvas>
    </div>
  )
}
