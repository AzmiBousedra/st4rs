"use client"

import { useMemo, useRef } from "react"
import { AdditiveBlending, Color, Mesh } from "three"
import { useFrame } from "@react-three/fiber"
import starsJson from "../data/stars.json"

// what the UI receives when a star is selected
export type StarSelectionInfo = {
  position: [number, number, number]
  name: string
  status: string
  type: string
  temperature: number
  size: string
}

type SpectralClass = "O" | "B" | "A" | "F" | "G" | "K" | "M"

type StarAttributes = {
  name: string
  status: string
  spectralClass: SpectralClass
  temperature: number
  radiusSun: number
}

type StarData = {
  position: [number, number, number]
  meshScale: number
  color: string
  glowIntensity: number
  attributes: StarAttributes
}

type StarFieldProps = {
  onStarSelect?: (info: StarSelectionInfo) => void
}

type CatalogStar = {
  name: string | null
  raHours: number
  decDeg: number
  distParsec: number
  mag: number
  spect: string | null
  x: number
  y: number
  z: number
}

// real-ish main sequence ranges per spectral class
const SPECTRAL_CONFIG: Record<
  SpectralClass,
  {
    tempRange: [number, number]
    radiusRangeSun: [number, number] // radius in units of Sun radius
    color: string
    label: string
  }
> = {
  O: {
    tempRange: [30000, 50000],
    radiusRangeSun: [6, 10],
    color: "#9ad6ff",
    label: "O-type blue star",
  },
  B: {
    tempRange: [10000, 30000],
    radiusRangeSun: [2, 6],
    color: "#a9c8ff",
    label: "B-type blue white star",
  },
  A: {
    tempRange: [7500, 10000],
    radiusRangeSun: [1.4, 2.0],
    color: "#d5e1ff",
    label: "A-type white star",
  },
  F: {
    tempRange: [6000, 7500],
    radiusRangeSun: [1.15, 1.4],
    color: "#fff7ea",
    label: "F-type yellow white star",
  },
  G: {
    tempRange: [5200, 6000],
    radiusRangeSun: [0.9, 1.15],
    color: "#ffe7b3",
    label: "G-type yellow star",
  },
  K: {
    tempRange: [3700, 5200],
    radiusRangeSun: [0.7, 0.9],
    color: "#ffb874",
    label: "K-type orange star",
  },
  M: {
    tempRange: [2400, 3700],
    radiusRangeSun: [0.1, 0.7],
    color: "#ff9657",
    label: "M-type red dwarf",
  },
}

function randInRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

// pick spectral class from catalog spect string or fallback based on magnitude
function inferSpectralClass(star: CatalogStar): SpectralClass {
  const raw = (star.spect || "").trim()
  if (raw.length > 0) {
    const c = raw[0].toUpperCase()
    if (c === "O" || c === "B" || c === "A" || c === "F" || c === "G" || c === "K" || c === "M") {
      return c
    }
  }

  // fallback: rough mapping from magnitude if spect is missing
  const m = star.mag
  if (m <= 0.0) return "B"
  if (m <= 1.5) return "A"
  if (m <= 3.0) return "F"
  if (m <= 4.5) return "G"
  if (m <= 6.0) return "K"
  return "M"
}

export function StarField({ onStarSelect }: StarFieldProps) {
  const stars = useMemo<StarData[]>(() => {
    const raw = starsJson as CatalogStar[]

    // you can limit count here if too heavy:
    // const subset = raw.slice(0, 2000)
    const subset = raw

    return subset.map((s) => {
      const cls = inferSpectralClass(s)
      const cfg = SPECTRAL_CONFIG[cls]

      const temp = Math.round(
        randInRange(cfg.tempRange[0], cfg.tempRange[1])
      )

      const radiusSun = randInRange(
        cfg.radiusRangeSun[0],
        cfg.radiusRangeSun[1]
      )

      // scale mesh size from physical radius
      const SCALE = 0.05
      const meshScale = radiusSun * SCALE

      return {
        position: [s.x, s.y, s.z] as [number, number, number],
        meshScale,
        color: cfg.color,
        glowIntensity: 0.3 + Math.random() * 0.6,
        attributes: {
          name: s.name || "Unnamed star",
          status: "unclaimed",
          spectralClass: cls,
          temperature: temp,
          radiusSun,
        },
      }
    })
  }, [])

  return (
    <group>
      {stars.map((star, index) => (
        <Star
          key={index}
          index={index}
          data={star}
          onSelect={onStarSelect}
        />
      ))}
    </group>
  )
}

type StarProps = {
  data: StarData
  index: number
  onSelect?: (info: StarSelectionInfo) => void
}

function Star({ data, index, onSelect }: StarProps) {
  const coreRef = useRef<Mesh | null>(null)
  const glowRef = useRef<Mesh | null>(null)

  const tint = new Color(data.color)
  const white = new Color("#ffffff")

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    const wobble = 0.02
    const speed = 0.12

    const [bx, by, bz] = data.position
    const x = bx + Math.sin(t * speed + index * 0.3) * wobble
    const y = by + Math.cos(t * speed * 1.1 + index * 0.2) * wobble
    const z =
      bz + Math.sin(t * speed * 0.8 + index * 0.4) * wobble * 0.6

    if (coreRef.current) coreRef.current.position.set(x, y, z)
    if (glowRef.current) glowRef.current.position.set(x, y, z)

    const flicker =
      1.1 +
      Math.sin(t * 3.2 + index * 0.4) * 0.15 +
      Math.cos(t * 2.1 + index * 0.3) * 0.1

    const color = white
      .clone()
      .lerp(tint, 0.6)
      .multiplyScalar(flicker)

    if (coreRef.current) {
      const mat = coreRef.current.material as any
      if (mat && mat.color) mat.color.copy(color)
    }

    if (glowRef.current) {
      const mat = glowRef.current.material as any
      if (mat && mat.color) {
        mat.color.copy(color)
        mat.opacity = data.glowIntensity * 0.55
      }
      const baseScale = data.meshScale * 4.5
      const pulse =
        1 +
        Math.sin(t * 1.6 + index * 0.5) * 0.25
      glowRef.current.scale.setScalar(baseScale * pulse)
    }
  })

  const handleClick = (e: any) => {
    e.stopPropagation()
    if (!onSelect) return

    const attr = data.attributes
    onSelect({
      position: data.position,
      name: attr.name,
      status: attr.status,
      type: `${attr.spectralClass}-type star`,
      temperature: attr.temperature,
      size: `${attr.radiusSun.toFixed(2)} x Sun radius`,
    })
  }

  return (
    <>
      {/* core */}
      <mesh
        ref={coreRef}
        position={data.position}
        scale={data.meshScale}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={"white"} />
      </mesh>

      {/* glow */}
      <mesh ref={glowRef} position={data.position}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}
