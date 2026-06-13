/*
 * analyze-emblem-art.mjs — mide arch.png y leo-c.png: bounding box del
 * CONTENIDO (píxeles con tinta) para centrar, e histograma de luminancia
 * del león para calibrar el rango del reveal. Solo imprime; no escribe.
 */
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'

const ART = new URL('../assets/zodiac-art/', import.meta.url)
const load = (f) => PNG.sync.read(readFileSync(new URL(f, ART)))

function analyze(name) {
  const img = load(name)
  const { width: W, height: H, data } = img
  let minX = W, minY = H, maxX = -1, maxY = -1
  const hist = new Array(20).fill(0)
  let inked = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
      if (lum > 0.06) {
        inked++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        hist[Math.min(19, Math.floor(lum * 20))]++
      }
    }
  }
  const bboxW = maxX - minX
  const bboxH = maxY - minY
  console.log(`\n=== ${name} (${W}×${H}) ===`)
  console.log(
    `bbox: x[${minX}..${maxX}] y[${minY}..${maxY}] → ${bboxW}×${bboxH}`,
  )
  console.log(
    `centro del contenido: (${((minX + maxX) / 2 / W).toFixed(3)}, ${((minY + maxY) / 2 / H).toFixed(3)}) en fracción`,
  )
  console.log(`margen: L=${(minX / W).toFixed(3)} R=${(1 - maxX / W).toFixed(3)} T=${(minY / H).toFixed(3)} B=${(1 - maxY / H).toFixed(3)}`)
  console.log(`inked: ${((inked / (W * H)) * 100).toFixed(1)}%`)
  // histograma compacto (solo bins con tinta)
  const tot = hist.reduce((a, b) => a + b, 0)
  console.log('luminancia (bin 0.05): ' + hist.map((c, i) => (c > 0 ? `${(i * 0.05).toFixed(2)}:${((c / tot) * 100).toFixed(0)}%` : null)).filter(Boolean).join(' '))
}

analyze('arch.png')
analyze('leo-c.png')
