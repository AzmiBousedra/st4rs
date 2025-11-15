"use client"

import { useMemo, useRef } from "react"
import { Color, Mesh } from "three"
import { useFrame } from "@react-three/fiber"
import starsJson from "../data/stars.json"

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
  attributes: StarAttributes
}

type StarFieldProps = {
  onStarSelect?: (info: StarSelectionInfo) => void
  // used for desaturation logic
  selectedName?: string | null
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

const SPECTRAL_CONFIG: Record<
  SpectralClass,
  {
    tempRange: [number, number]
    radiusRangeSun: [number, number]
    color: string
    label: string
  }
> = {
  O: {
    tempRange: [30000, 50000],
    radiusRangeSun: [6, 10],
    color: "#7dd7ff",
    label: "O-type blue star",
  },
  B: {
    tempRange: [10000, 30000],
    radiusRangeSun: [2, 6],
    color: "#8fb9ff",
    label: "B-type blue white star",
  },
  A: {
    tempRange: [7500, 10000],
    radiusRangeSun: [1.4, 2.0],
    color: "#e0e6ff",
    label: "A-type white star",
  },
  F: {
    tempRange: [6000, 7500],
    radiusRangeSun: [1.15, 1.4],
    color: "#ffe9c2",
    label: "F-type yellow white star",
  },
  G: {
    tempRange: [5200, 6000],
    radiusRangeSun: [0.9, 1.15],
    color: "#ffd27a",
    label: "G-type yellow star",
  },
  K: {
    tempRange: [3700, 5200],
    radiusRangeSun: [0.7, 0.9],
    color: "#ff9c4a",
    label: "K-type orange star",
  },
  M: {
    tempRange: [2400, 3700],
    radiusRangeSun: [0.1, 0.7],
    color: "#ff6b3b",
    label: "M-type red dwarf",
  },
}

function randInRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function inferSpectralClass(star: CatalogStar): SpectralClass {
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

// remap catalog coordinates into visible shell
function remapPosition(
  x: number,
  y: number,
  z: number
): [number, number, number] {
  const rOrig = Math.sqrt(x * x + y * y + z * z) || 1e-6
  const VIS_MIN = 20
  const VIS_MAX = 85
  const targetR = randInRange(VIS_MIN, VIS_MAX)
  const k = targetR / rOrig
  return [x * k, y * k, z * k]
}

export function StarField({
  onStarSelect,
  selectedName,
}: StarFieldProps) {
  const stars = useMemo<StarData[]>(() => {
    const raw = starsJson as CatalogStar[]

    const sorted = [...raw].sort(
      (a, b) => a.distParsec - b.distParsec
    )
    const subset = sorted.slice(0, 2500)

    return subset.map((s, index) => {
      const cls = inferSpectralClass(s)
      const cfg = SPECTRAL_CONFIG[cls]

      const temperature = Math.round(
        randInRange(cfg.tempRange[0], cfg.tempRange[1])
      )

      const radiusSun = randInRange(
        cfg.radiusRangeSun[0],
        cfg.radiusRangeSun[1]
      )

      const SCALE = 0.09
      const meshScale = radiusSun * SCALE

      const [nx, ny, nz] = remapPosition(s.x, s.y, s.z)

      // each unnamed star gets a unique label
      const displayName =
        s.name && s.name.trim().length > 0
          ? s.name
          : `Unnamed #${index}`

      return {
        position: [nx, ny, nz] as [number, number, number],
        meshScale,
        color: cfg.color,
        attributes: {
          name: displayName,
          status: "unclaimed",
          spectralClass: cls,
          temperature,
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
          selectedName={selectedName}
        />
      ))}
    </group>
  )
}

type StarProps = {
  data: StarData
  index: number
  onSelect?: (info: StarSelectionInfo) => void
  selectedName?: string | null
}

function Star({
  data,
  index,
  onSelect,
  selectedName,
}: StarProps) {
  const coreRef = useRef<Mesh | null>(null)

  const tint = new Color(data.color)
  const white = new Color("#ffffff")
  const grey = new Color("#555555")

  // 0 = fully grey, 1 = fully colorful
  const focusMixRef = useRef(1)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    const wobble = 0.02
    const speed = 0.12

    const [bx, by, bz] = data.position
    const x = bx + Math.sin(t * speed + index * 0.3) * wobble
    const y = by + Math.cos(t * speed * 1.1 + index * 0.2) * wobble
    const z =
      bz + Math.sin(t * speed * 0.8 + index * 0.4) * wobble * 0.6

    if (coreRef.current) {
      coreRef.current.position.set(x, y, z)
    }

    const flicker =
      1.3 +
      Math.sin(t * 3.0 + index * 0.4) * 0.25 +
      Math.cos(t * 2.1 + index * 0.3) * 0.18

    const hasSelection = !!selectedName
    const isSelected =
      hasSelection &&
      data.attributes.name === selectedName

    // no selection: all colorful
    // selection: only the selected one colorful, others grey
    const shouldBeColorful = !hasSelection || isSelected

    const targetMix = shouldBeColorful ? 1 : 0
    focusMixRef.current +=
      (targetMix - focusMixRef.current) * 0.12
    const mix = focusMixRef.current

    const colorfulBase = white
      .clone()
      .lerp(tint, 0.85)
      .multiplyScalar(flicker * 1.9)

    const greyBase = grey.clone().multiplyScalar(flicker * 1.1)

    const finalColor = greyBase.lerp(colorfulBase, mix)

    if (coreRef.current) {
      const mat = coreRef.current.material as any
      if (mat && mat.color) mat.color.copy(finalColor)
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
    <mesh
      ref={coreRef}
      position={data.position}
      scale={data.meshScale}
      onClick={handleClick}
    >
      {/* single sphere, bloom does the glow */}
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color={"white"} toneMapped />
    </mesh>
  )
}
