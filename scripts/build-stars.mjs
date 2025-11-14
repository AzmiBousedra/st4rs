// scripts/build-stars.mjs
import fs from "fs"
import path from "path"
import readline from "readline"
import url from "url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const inputPath = path.join(__dirname, "..", "data", "stars.csv")
const outputPath = path.join(__dirname, "..", "data", "stars.json")

// These indices match typical HYG CSV:
// id,hip,hd,hr,gl,bf,proper,ra,dec,dist,mag,absmag,spect,ci,x,y,z,...
// Adjust if your file differs.
const IDX_PROPER = 6      // "proper"
const IDX_RA = 7          // "ra" in hours
const IDX_DEC = 8         // "dec" in degrees
const IDX_DIST = 9        // "dist" parsec
const IDX_MAG = 10        // "mag"
const IDX_SPECT = 15      // "spect" spectral type (like G2V, K5III etc)

function parseFloatSafe(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function rarityFromMag(mag) {
  if (mag <= 1.0) return "mythic"
  if (mag <= 2.0) return "legendary"
  if (mag <= 3.0) return "epic"
  if (mag <= 4.0) return "rare"
  if (mag <= 5.0) return "uncommon"
  return "common"
}

// convert RA, Dec, dist to x,y,z
function toXYZ(raHours, decDeg, distParsec) {
  const raRad = (raHours * Math.PI) / 12   // 24h -> 2π
  const decRad = (decDeg * Math.PI) / 180

  const SCALE = 0.5
  const r = distParsec * SCALE

  const x = r * Math.cos(decRad) * Math.cos(raRad)
  const y = r * Math.cos(decRad) * Math.sin(raRad)
  const z = r * Math.sin(decRad)

  return { x, y, z }
}

async function main() {
  const stream = fs.createReadStream(inputPath, { encoding: "utf8" })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  const result = []
  let isFirstLine = true

  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false
      continue
    }
    if (!line.trim()) continue

    const cols = line.split(",")

    let proper = cols[IDX_PROPER]?.trim() || ""
    const raRaw = parseFloatSafe(cols[IDX_RA])
    const decRaw = parseFloatSafe(cols[IDX_DEC])
    const distRaw = parseFloatSafe(cols[IDX_DIST])
    const magRaw = parseFloatSafe(cols[IDX_MAG])
    const spectRaw = (cols[IDX_SPECT] || "").trim()

    if (
      raRaw === null ||
      decRaw === null ||
      distRaw === null ||
      magRaw === null
    ) {
      continue
    }

    // closest star in this catalog is basically the Sun
    if (distRaw < 0.001) {
      proper = "Sun"
    }

    // filter: bright enough and not insanely far
    if (magRaw > 6.0) continue
    if (distRaw > 2000) continue

    const { x, y, z } = toXYZ(raRaw, decRaw, distRaw)

    result.push({
      name: proper || null,
      raHours: raRaw,
      decDeg: decRaw,
      distParsec: distRaw,
      mag: magRaw,
      spect: spectRaw || null,
      x,
      y,
      z,
      rarity: rarityFromMag(magRaw),
    })
  }

  console.log("Stars kept:", result.length)

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8")
  console.log("Written to", outputPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
