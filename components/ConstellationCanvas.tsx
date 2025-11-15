"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing"
import { Suspense, useMemo, useRef, useState } from "react"
import { Color, Mesh, Vector3 } from "three"

type StarRarity = "common" | "uncommon"

type InventoryStar = {
  id: string
  rarity: StarRarity
  placed: boolean
  position: [number, number, number] | null
  name: string
  status: string
  type: string
  temperature: number
  sizeLabel: string
}

type RarityVisualConfig = {
  sizeRange: [number, number]
  color: string
  flickerStrength: number
  typeName: string
  sizeLabel: string
  temperatureRange: [number, number]
}

const RARITY_VISUAL_CONFIG: Record<StarRarity, RarityVisualConfig> = {
  common: {
    sizeRange: [0.05, 0.08],
    color: "#ffb26b",
    flickerStrength: 0.07,
    typeName: "K/M-type dwarf",
    sizeLabel: "Small",
    temperatureRange: [3000, 5000],
  },
  uncommon: {
    sizeRange: [0.06, 0.095],
    color: "#ffd86b",
    flickerStrength: 0.1,
    typeName: "G-type star",
    sizeLabel: "Medium",
    temperatureRange: [5000, 6000],
  },
}

function randInRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function snapToGrid(
  pos: Vector3,
  step = 1
): [number, number, number] {
  const x = Math.round(pos.x / step) * step
  const y = Math.round(pos.y / step) * step
  const z = Math.round(pos.z / step) * step
  return [x, y, z]
}

// simple ISS-like home base at the origin
function HomeShip() {
  return (
    <group position={[0, 0, 0]}>
      {/* main body bar */}
      <mesh>
        <boxGeometry args={[2.8, 1.2, 1.2]} />
        <meshStandardMaterial
          color="#cfd8ff"
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>

      {/* bright central core */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 0.9, 0.9]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#8fd3ff"
          emissiveIntensity={1.4}
          metalness={0.4}
          roughness={0.2}
        />
      </mesh>

      {/* solar panel left */}
      <mesh position={[-2.2, 0, 0]}>
        <boxGeometry args={[2.6, 0.2, 1.4]} />
        <meshStandardMaterial
          color="#2b3f74"
          emissive="#364f8f"
          emissiveIntensity={0.7}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>

      {/* solar panel right */}
      <mesh position={[2.2, 0, 0]}>
        <boxGeometry args={[2.6, 0.2, 1.4]} />
        <meshStandardMaterial
          color="#2b3f74"
          emissive="#364f8f"
          emissiveIntensity={0.7}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>

      {/* front docking tube */}
      <mesh position={[0, 0, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 1.2, 16]} />
        <meshStandardMaterial
          color="#dfe4ff"
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* back tube */}
      <mesh position={[0, 0, -1.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 1.2, 16]} />
        <meshStandardMaterial
          color="#dfe4ff"
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* small nav lights */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#7df3ff" />
      </mesh>
      <mesh position={[0, -0.7, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#ffb37d" />
      </mesh>
    </group>
  )
}

export function ConstellationCanvas() {
  const [inventory, setInventory] = useState<InventoryStar[]>(() => {
    const items: InventoryStar[] = []

    const makeStar = (rarity: StarRarity, index: number): InventoryStar => {
      const cfg = RARITY_VISUAL_CONFIG[rarity]
      const temp = Math.round(
        randInRange(cfg.temperatureRange[0], cfg.temperatureRange[1])
      )
      return {
        id: `${rarity}-${index}`,
        rarity,
        placed: false,
        position: null,
        name: "???",
        status: "unclaimed",
        type: cfg.typeName,
        temperature: temp,
        sizeLabel: cfg.sizeLabel,
      }
    }

    for (let i = 0; i < 5; i++) {
      items.push(makeStar("common", i))
    }
    for (let i = 0; i < 2; i++) {
      items.push(makeStar("uncommon", i))
    }
    return items
  })

  const [editMode, setEditMode] = useState(false)
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null)
  const [selectedStar, setSelectedStar] = useState<InventoryStar | null>(null)

  const placedStars = useMemo(
    () => inventory.filter((s) => s.placed && s.position !== null),
    [inventory]
  )

  const handleToggleEdit = () => {
    setEditMode((prev) => !prev)
    if (editMode) {
      setSelectedInventoryId(null)
    }
  }

  const handleSelectInventoryStar = (id: string) => {
    if (!editMode) return
    setSelectedInventoryId((prev) => (prev === id ? null : id))
  }

  const handleReturnToInventory = (id: string) => {
    setInventory((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              placed: false,
              position: null,
            }
          : s
      )
    )

    if (selectedInventoryId === id) {
      setSelectedInventoryId(null)
    }
    if (selectedStar && selectedStar.id === id) {
      setSelectedStar(null)
    }
  }

  const handlePlaneClick = (pos: Vector3) => {
    if (!editMode || !selectedInventoryId) return

    const snapped = snapToGrid(pos, 1)

    const baseStar = inventory.find((s) => s.id === selectedInventoryId)
    if (!baseStar) return

    const updatedStar: InventoryStar = {
      ...baseStar,
      placed: true,
      position: snapped,
    }

    setInventory((prev) =>
      prev.map((s) =>
        s.id === selectedInventoryId ? updatedStar : s
      )
    )

    setSelectedStar(updatedStar)
  }

  const handlePlacedStarClick = (id: string) => {
    const star = inventory.find((s) => s.id === id)
    if (!star || !star.position) return

    setSelectedStar(star)

    if (editMode) {
      setSelectedInventoryId(id)
    }
  }

  const clearSelection = () => {
    setSelectedStar(null)
    setSelectedInventoryId(null)
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, 18], fov: 60 }}
        gl={{ antialias: true }}
        onPointerMissed={(e) => {
          if (e.type === "click") {
            clearSelection()
          }
        }}
      >
        <color attach="background" args={["black"]} />

        {/* lights so the station is visible */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 15, 10]} intensity={1.4} />

        <Suspense fallback={null}>
          {/* home base at origin */}
          <HomeShip />

          {/* invisible plane where we drop stars */}
          <PlacementPlane
            editMode={editMode}
            onPlace={handlePlaneClick}
          />

          {/* placed stars */}
          {placedStars.map((s) => (
            <ConstellationStar
              key={s.id}
              star={s}
              editMode={editMode}
              selected={selectedStar?.id === s.id}
              onClick={handlePlacedStarClick}
            />
          ))}
        </Suspense>

        <EffectComposer disableNormalPass>
          <Bloom
            intensity={2.0}
            luminanceThreshold={0.12}
            luminanceSmoothing={0.85}
            mipmapBlur
          />
          <Vignette offset={0.3} darkness={0.7} />
        </EffectComposer>

        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.6}
          zoomSpeed={0.6}
          panSpeed={0.6}
          minDistance={4}
          maxDistance={40}
          makeDefault
        />

        <ConstellationCameraRig
          targetPos={selectedStar?.position ?? null}
        />
      </Canvas>

      {/* top center: edit mode toggle */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={handleToggleEdit}
          style={{
            backgroundColor: editMode ? "white" : "black",
            color: editMode ? "black" : "white",
            borderRadius: "9999px",
            padding: "0.35rem 0.85rem",
            fontSize: "0.8rem",
            border: "1px solid rgba(255,255,255,0.4)",
            cursor: "pointer",
          }}
        >
          {editMode ? "Exit edit mode" : "Edit constellation"}
        </button>
      </div>

      {/* right side: inventory */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "0.75rem 1rem",
          borderRadius: "0.5rem",
          fontSize: "0.8rem",
          border: "1px solid rgba(255,255,255,0.15)",
          maxWidth: "260px",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
          Star inventory
        </div>
        {inventory.map((star) => {
          const cfg = RARITY_VISUAL_CONFIG[star.rarity]
          const selected = selectedInventoryId === star.id
          const placed = star.placed

          return (
            <div
              key={star.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.35rem",
                opacity: placed && !editMode ? 0.6 : 1,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "0.65rem",
                      height: "0.65rem",
                      borderRadius: "9999px",
                      background: cfg.color,
                    }}
                  />
                  {star.rarity === "common"
                    ? "Common star"
                    : "Uncommon star"}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.8,
                  }}
                >
                  {placed && star.position
                    ? `Placed at (${star.position
                        .map((v) => v.toFixed(0))
                        .join(", ")})`
                    : "In inventory"}
                </div>
              </div>

              {placed ? (
                <button
                  onClick={() => handleReturnToInventory(star.id)}
                  style={{
                    marginLeft: "0.5rem",
                    backgroundColor: "transparent",
                    color: "white",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.4)",
                    padding: "0.15rem 0.55rem",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                  }}
                >
                  Return
                </button>
              ) : (
                <button
                  disabled={!editMode}
                  onClick={() => handleSelectInventoryStar(star.id)}
                  style={{
                    marginLeft: "0.5rem",
                    backgroundColor: selected
                      ? "white"
                      : "transparent",
                    color: selected ? "black" : "white",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.4)",
                    padding: "0.15rem 0.55rem",
                    fontSize: "0.7rem",
                    cursor: editMode ? "pointer" : "not-allowed",
                    opacity: editMode ? 1 : 0.5,
                  }}
                >
                  {selected ? "Selected" : "Use"}
                </button>
              )}
            </div>
          )
        })}

        {!editMode && (
          <div
            style={{
              marginTop: "0.35rem",
              fontSize: "0.7rem",
              opacity: 0.7,
            }}
          >
            Enter edit mode to place stars freely in space.
          </div>
        )}
      </div>

      {/* bottom right: info box for selected star */}
      {selectedStar && selectedStar.position && (
        <div
          style={{
            position: "absolute",
            bottom: "1.5rem",
            right: "1.5rem",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              backgroundColor: "rgba(0,0,0,0.85)",
              color: "white",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              lineHeight: "1.25rem",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
              minWidth: "220px",
            }}
          >
            <div style={{ marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 600 }}>Name:</span>{" "}
              {selectedStar.name}
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 600 }}>Status:</span>{" "}
              {selectedStar.status}
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 600 }}>Type:</span>{" "}
              {selectedStar.type}
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 600 }}>Temperature:</span>{" "}
              {selectedStar.temperature.toLocaleString()} K
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Size:</span>{" "}
              {selectedStar.sizeLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// invisible plane used for placement, snapped to grid
type PlacementPlaneProps = {
  editMode: boolean
  onPlace: (pos: Vector3) => void
}

function PlacementPlane({ editMode, onPlace }: PlacementPlaneProps) {
  const planeRef = useRef<Mesh | null>(null)

  return (
    <mesh
      ref={planeRef}
      position={[0, 0, 0]}
      rotation={[0, 0, 0]}
      onClick={(e) => {
        if (!editMode) return
        e.stopPropagation()
        onPlace(e.point.clone())
      }}
    >
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  )
}

// constellation star with cinematic glow
type ConstellationStarProps = {
  star: InventoryStar
  editMode: boolean
  selected: boolean
  onClick: (id: string) => void
}

function ConstellationStar({
  star,
  editMode,
  selected,
  onClick,
}: ConstellationStarProps) {
  const cfg = RARITY_VISUAL_CONFIG[star.rarity]
  const baseSize = useMemo(
    () => randInRange(cfg.sizeRange[0], cfg.sizeRange[1]),
    [cfg.sizeRange]
  )

  const tintColor = useMemo(() => new Color(cfg.color), [cfg.color])
  const white = useMemo(() => new Color("#ffffff"), [])
  const coreRef = useRef<Mesh | null>(null)

  useFrame(({ clock }) => {
    if (!coreRef.current || !star.position) return
    const t = clock.getElapsedTime()

    const wobble = 0.02
    const x = star.position[0] + Math.sin(t * 0.4 + star.position[1]) * wobble
    const y = star.position[1] + Math.cos(t * 0.35 + star.position[0]) * wobble
    const z = star.position[2]

    coreRef.current.position.set(x, y, z)

    const flickerBase = 1.4
    const flickerAmp = cfg.flickerStrength * 1.5
    const flicker =
      flickerBase +
      Math.sin(t * 2.4 + star.position[0]) * flickerAmp +
      Math.cos(t * 1.6 + star.position[1]) * flickerAmp * 0.5

    const mixed = white.clone().lerp(tintColor, 0.6)
    const finalColor = mixed.multiplyScalar(Math.max(flicker, 1.4))

    const mat = coreRef.current.material as any
    if (mat && mat.color) {
      mat.color.copy(finalColor)
    }
  })

  if (!star.position) return null

  return (
    <mesh
      ref={coreRef}
      position={star.position}
      scale={baseSize * (selected ? 1.2 : 1)}
      onClick={(e) => {
        e.stopPropagation()
        onClick(star.id)
      }}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  )
}

// camera rig that eases focus to the selected star
type CameraRigProps = {
  targetPos: [number, number, number] | null
}

function ConstellationCameraRig({ targetPos }: CameraRigProps) {
  const { camera, controls } = useThree() as any

  const targetVec = new Vector3()
  const desiredPos = new Vector3()
  const currentPos = new Vector3()
  const currentTarget = new Vector3()
  const offset = new Vector3()

  useFrame(() => {
    if (!controls) return

    const targetArr = targetPos ?? [0, 0, 0]

    currentTarget.copy(controls.target)
    currentPos.copy(camera.position)

    offset.copy(currentPos).sub(currentTarget)

    targetVec.set(targetArr[0], targetArr[1], targetArr[2])

    currentTarget.lerp(targetVec, 0.12)
    desiredPos.copy(currentTarget).add(offset)

    camera.position.lerp(desiredPos, 0.12)
    controls.target.copy(currentTarget)

    camera.updateProjectionMatrix()
    controls.update()
  })

  return null
}
