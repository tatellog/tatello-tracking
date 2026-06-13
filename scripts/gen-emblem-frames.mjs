/*
 * gen-emblem-frames.mjs — pre-hornea el reveal del animal en N frames
 * PNG TRANSPARENTES. En la app se muestra el frame que toca según el %
 * (sin runtime shader — el shader de Skia resultó poco fiable).
 *
 * Pasos:
 *   1. RECORTA el art a su contenido (cuadrado centrado en el animal),
 *      así todos los signos quedan con el animal centrado y del mismo
 *      tamaño relativo → el componente los coloca uniforme.
 *   2. Reveal ESPACIAL RADIAL: el animal se materializa del centro hacia
 *      afuera (el line-art tiene brillo uniforme, así que un reveal por
 *      luminancia lo mostraría de golpe).
 *   3. Recolor a ORO por intensidad + gate que mata el fondo negro.
 *
 * Salida: assets/zodiac-art/<sign>-reveal/fNN.png  (NN = 00..10, cuadrado)
 *
 * Uso: node scripts/gen-emblem-frames.mjs leo leo-c.png
 */
import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'

const [, , sign, file] = process.argv
if (!sign || !file) {
  console.error('uso: node scripts/gen-emblem-frames.mjs <sign> <animal.png>')
  process.exit(1)
}

const ART = new URL('../assets/zodiac-art/', import.meta.url)
const src = PNG.sync.read(readFileSync(new URL(file, ART)))
const { width: SW, height: SH, data: SD } = src

// Recolor a oro (coherente con el aro; el magenta de la constelación queda
// como único acento frío). Gradiente por intensidad: tenue → oro profundo,
// brillante → crema.
const ORO_DEEP = [184, 147, 90] // #B8935A
const ORO_LECHE = [255, 246, 229] // #FFF6E5
const FB_LO = 0.62 // brillo del frame: tenue al inicio → pleno al 100%
const FB_HI = 1.0
const STEPS = 11 // 0,10,…,100
const OUT_W = 480 // lado de los frames (cuadrados)
const RADIAL_FEATHER = 0.16
const CROP_PAD = 0.08 // aire alrededor del contenido en el recorte

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lumAt = (i) => {
  const a = SD[i + 3] / 255
  return (SD[i] * 0.299 + SD[i + 1] * 0.587 + SD[i + 2] * 0.114) * a / 255
}

// 1 · bbox + CENTROIDE de luminancia (centro de MASA, no del bounding
// box) → recorte cuadrado centrado en el centro óptico, así la figura
// queda balanceada (la masa densa al centro), no su caja. Robusto para
// los 12 signos sin nudge por signo.
let minX = SW, minY = SH, maxX = -1, maxY = -1
let sumL = 0, sumLX = 0, sumLY = 0
for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    const lum = lumAt((y * SW + x) * 4)
    if (lum > 0.06) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      sumL += lum
      sumLX += lum * x
      sumLY += lum * y
    }
  }
}
const cenX = sumL ? sumLX / sumL : (minX + maxX) / 2
const cenY = sumL ? sumLY / sumL : (minY + maxY) / 2
// El recorte (cuadrado, centrado en el centroide) debe CONTENER todo el
// bbox → medio lado = mayor distancia del centroide a un borde del bbox.
const half = Math.max(cenX - minX, maxX - cenX, cenY - minY, maxY - cenY) * (1 + CROP_PAD)
const side = 2 * half
const cropX = cenX - half
const cropY = cenY - half

const outDir = new URL(`${sign}-reveal/`, ART)
mkdirSync(outDir, { recursive: true })

// Distancia normalizada al centro (cuadrado → 0 centro, 1 esquina).
const HALF = Math.SQRT1_2 // dist a la esquina desde el centro en 0..1
function distNorm(x, y) {
  return Math.hypot(x / OUT_W - 0.5, y / OUT_W - 0.5) / HALF
}

for (let s = 0; s < STEPS; s++) {
  const p = s / (STEPS - 1)
  const pe = Math.pow(p, 0.6) // ease-out: el centro emerge rápido al inicio
  const front = -RADIAL_FEATHER + (1 + 2 * RADIAL_FEATHER) * pe
  const fb = FB_LO + (FB_HI - FB_LO) * p
  const png = new PNG({ width: OUT_W, height: OUT_W })
  for (let y = 0; y < OUT_W; y++) {
    for (let x = 0; x < OUT_W; x++) {
      const oi = (y * OUT_W + x) * 4
      // pixel de salida → coord en el recorte → fuente
      const fx = Math.round(cropX + (x / OUT_W) * side)
      const fy = Math.round(cropY + (y / OUT_W) * side)
      if (fx < 0 || fx >= SW || fy < 0 || fy >= SH) {
        png.data[oi] = png.data[oi + 1] = png.data[oi + 2] = png.data[oi + 3] = 0
        continue
      }
      const si = (fy * SW + fx) * 4
      const sa = SD[si + 3] / 255
      const r = SD[si] * sa
      const g = SD[si + 1] * sa
      const b = SD[si + 2] * sa
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      const gate = smoothstep(0.06, 0.14, lum) // mata el fondo negro
      const radial = smoothstep(front + RADIAL_FEATHER, front - RADIAL_FEATHER, distNorm(x, y))
      const a = gate * radial
      const av = Math.round(a * 255)
      const t = Math.max(0, Math.min(1, (lum - 0.06) / (0.55 - 0.06)))
      png.data[oi] = av === 0 ? 0 : Math.min(255, (ORO_DEEP[0] + (ORO_LECHE[0] - ORO_DEEP[0]) * t) * fb)
      png.data[oi + 1] = av === 0 ? 0 : Math.min(255, (ORO_DEEP[1] + (ORO_LECHE[1] - ORO_DEEP[1]) * t) * fb)
      png.data[oi + 2] = av === 0 ? 0 : Math.min(255, (ORO_DEEP[2] + (ORO_LECHE[2] - ORO_DEEP[2]) * t) * fb)
      png.data[oi + 3] = av
    }
  }
  writeFileSync(new URL(`f${String(s).padStart(2, '0')}.png`, outDir), Buffer.from(PNG.sync.write(png)))
}
console.log(`${sign}: ${STEPS} frames ${OUT_W}² (recorte cuadrado) → ${sign}-reveal/`)
