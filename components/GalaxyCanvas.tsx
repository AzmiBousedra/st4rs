"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { useRef, useState } from "react"
import * as THREE from "three"
import { StarField, StarSelectionInfo } from "./StarField"

type FocusState = {
  target: THREE.Vector3
  enabled: boolean
}

export default function GalaxyCanvas() {
  const [selectedStar, setSelectedStar] = useState<StarSelectionInfo | null>(
    null
  )
  const [searchValue, setSearchValue] = useState("")

  const [focus, setFocus] = useState<FocusState>({
    target: new THREE.Vector3(0, 0, 0),
    enabled: false,
  })

  const handleStarSelect = (info: StarSelectionInfo) => {
    const v = new THREE.Vector3(...info.position)

    setSelectedStar(info)
    setFocus({
      enabled: true,
      target: v,
    })
  }

  const handleVoidClick = () => {
    setSelectedStar(null)
    setFocus({
      enabled: false,
      target: new THREE.Vector3(0, 0, 0),
    })
  }

  const performSearch = async () => {
    if (!searchValue.trim()) return

    const stars = (await import("../data/stars.json")).default
    const target = stars.find(
      (s: any) =>
        s.name &&
        s.name.toLowerCase() === searchValue.toLowerCase()
    )

    if (!target) {
      console.warn("Star not found:", searchValue)
      return
    }

    const pos = new THREE.Vector3(target.x, target.y, target.z)

    setSelectedStar({
      position: [target.x, target.y, target.z],
      name: target.name || "Unnamed star",
      status: "unclaimed",
      type: target.type || "Unknown",
      temperature: target.temperature || 0,
      size: target.size || "",
    })

    setFocus({
      enabled: true,
      target: pos,
    })
  }

  return (
    <div className="relative w-full h-full">
      {/* Search Bar */}
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
            width: "180px",
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

      {/* Info Box */}
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
        camera={{ position: [0, 0, 45], fov: 55 }}
        onPointerMissed={handleVoidClick}
      >
        <color attach="background" args={["#000000"]} />

        <CameraFocusController focus={focus} selected={!!selectedStar} />

        <StarField onStarSelect={handleStarSelect} />

        <OrbitControls
          makeDefault
          enablePan={false}
          enableRotate={!focus.enabled}
          maxDistance={focus.enabled ? 10 : 300}
          minDistance={focus.enabled ? 1.5 : 10}
        />
      </Canvas>
    </div>
  )
}

function CameraFocusController({
  focus,
  selected,
}: {
  focus: FocusState
  selected: boolean
}) {
  const { camera } = useThree()
  const targetRef = useRef(new THREE.Vector3())

  useFrame(() => {
    if (focus.enabled) {
      const desired = focus.target
        .clone()
        .add(new THREE.Vector3(0, 0, 3))

      camera.position.lerp(desired, 0.07)
      targetRef.current.lerp(focus.target, 0.1)

      camera.lookAt(targetRef.current)
    } else {
      camera.position.lerp(new THREE.Vector3(0, 0, 45), 0.05)
      camera.lookAt(0, 0, 0)
    }
  })

  return null
}
