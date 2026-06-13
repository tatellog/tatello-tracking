/*
 * gen-emblem-frames.mjs — pre-hornea el reveal del animal en N frames
 * PNG TRANSPARENTES. En la app se muestra el frame que toca según el %
 * (sin runtime shader — el shader de Skia resultó poco fiable).
 *
 * Reveal ESPACIAL RADIAL: el animal se materializa del centro hacia
 * afuera. El line-art tiene brillo uniforme, así que un reveal por
 * luminancia haría aparecer todo el contorno de golpe; uno espacial lo
 * dibuja por zonas (centro → extremos), que es lo que se busca.
 * Cada pixel: se pinta su color (gold/glow) realzado SOLO si (a) es del
 * animal (gate de luminancia mata el fondo negro) y (b) ya entró el
 * frente radial de revelado.
 *
 * Salida: assets/zodiac-art/<sign>-reveal/fNN.png  (NN = 00..10)
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

// El animal se RECOLOREA a oro (coherente con el aro; el magenta de la
// constelación queda como único acento frío). Gradiente por intensidad:
// líneas tenues → oro profundo; núcleos brillantes → crema.
const ORO_DEEP = [184, 147, 90] // #B8935A
const ORO_LECHE = [255, 246, 229] // #FFF6E5
// Brillo por frame: tenue al inicio, pleno al 100% (el bloom de la app
// suma el resplandor).
const FB_LO = 0.62
const FB_HI = 1.0
const STEPS = 11 // 0,10,…,100
const OUT_W = 480 // resolución de los frames (el animal se ve ~200px)
const RADIAL_FEATHER = 0.16 // ancho del frente radial (suave)
const CENTER_X = 0.46 // centro del reveal (sesgado a la cara, izquierda)
const CENTER_Y = 0.46

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const OUT_H = Math.round(OUT_W * (src.height / src.width))
const outDir = new URL(`${sign}-reveal/`, ART)
mkdirSync(outDir, { recursive: true })

// Distancia normalizada de cada pixel al centro del reveal (en coords
// 0..1 corregidas por aspecto), dividida por la dist a la esquina más
// lejana → 0 en el centro, 1 en el extremo.
const aspect = OUT_W / OUT_H
function distNorm(x, y) {
  const dx = (x / OUT_W - CENTER_X) * aspect
  const dy = y / OUT_H - CENTER_Y
  return Math.hypot(dx, dy)
}
let maxDist = 0
for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
  const d = Math.hypot((cx - CENTER_X) * aspect, cy - CENTER_Y)
  if (d > maxDist) maxDist = d
}

for (let s = 0; s < STEPS; s++) {
  const p = s / (STEPS - 1) // 0..1
  // Ease-out: el centro emerge rápido al inicio (a 8% ya se ve un núcleo)
  // y desacelera al final. p=0 sigue vacío; p=1 sigue completo.
  const pe = Math.pow(p, 0.6)
  // Frente radial: de -feather (vacío) a 1+feather (todo revelado).
  const front = -RADIAL_FEATHER + (1 + 2 * RADIAL_FEATHER) * pe
  const fb = FB_LO + (FB_HI - FB_LO) * p // brillo del frame
  const png = new PNG({ width: OUT_W, height: OUT_H })
  for (let y = 0; y < OUT_H; y++) {
    for (let x = 0; x < OUT_W; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x / OUT_W) * src.width))
      const sy = Math.min(src.height - 1, Math.floor((y / OUT_H) * src.height))
      const si = (sy * src.width + sx) * 4
      const sa = src.data[si + 3] / 255
      const r = src.data[si] * sa
      const g = src.data[si + 1] * sa
      const b = src.data[si + 2] * sa
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      // Gate: mata la BRUMA ambiental del PNG fuente (lum ~0.025), deja
      // solo las líneas del animal + su glow real. Umbral alto a propósito
      // — si baja, se hornea una placa gris sucia en los frames llenos.
      const gate = smoothstep(0.06, 0.14, lum)
      const d = distNorm(x, y) / maxDist
      const radial = smoothstep(front + RADIAL_FEATHER, front - RADIAL_FEATHER, d) // dentro del frente
      const a = gate * radial
      const oi = (y * OUT_W + x) * 4
      const av = Math.round(a * 255)
      // Recolor a oro por intensidad de la línea (no el naranja fuente).
      const t = Math.max(0, Math.min(1, (lum - 0.06) / (0.55 - 0.06)))
      png.data[oi] = av === 0 ? 0 : Math.min(255, (ORO_DEEP[0] + (ORO_LECHE[0] - ORO_DEEP[0]) * t) * fb)
      png.data[oi + 1] = av === 0 ? 0 : Math.min(255, (ORO_DEEP[1] + (ORO_LECHE[1] - ORO_DEEP[1]) * t) * fb)
      png.data[oi + 2] = av === 0 ? 0 : Math.min(255, (ORO_DEEP[2] + (ORO_LECHE[2] - ORO_DEEP[2]) * t) * fb)
      png.data[oi + 3] = av
    }
  }
  const name = `f${String(s).padStart(2, '0')}.png`
  writeFileSync(new URL(name, outDir), Buffer.from(PNG.sync.write(png)))
}
console.log(`${sign}: ${STEPS} frames (${OUT_W}×${OUT_H}) radial → assets/zodiac-art/${sign}-reveal/`)
