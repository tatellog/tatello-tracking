/*
 * Rasteriza los SVG de arte zodiacal a PNG.
 *
 *   node scripts/gen-zodiac-png.mjs
 *
 * Por qué: los .svg de arte pesan 460–656 KB cada uno (miles de paths). En
 * Android react-native-svg los re-rasteriza por frame → es el cuello de
 * botella de la constelación. Mostrados a un tamaño FIJO (la card ~340 px),
 * un PNG a 3x (1024 px) se ve idéntico pero renderiza como UNA textura GPU.
 *
 * Salida: assets/zodiac-art/<sign>-art.png  (junto al .svg fuente).
 * El SVG queda como fuente; el componente de arte pasa a usar el PNG.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ART_DIR = join(ROOT, 'assets', 'zodiac-art')
const WIDTH = 1024 // ~3x del display (~340 px) → nítido sin desperdiciar peso

const svgs = readdirSync(ART_DIR).filter((f) => f.endsWith('.svg'))
if (svgs.length === 0) {
  console.error(`[gen-zodiac-png] No hay .svg en ${ART_DIR}`)
  process.exit(1)
}

let total = 0
for (const file of svgs) {
  const svg = readFileSync(join(ART_DIR, file), 'utf8')
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } })
  const png = resvg.render().asPng()
  const out = join(ART_DIR, basename(file, '.svg') + '.png')
  writeFileSync(out, png)
  const kb = (statSync(out).size / 1024).toFixed(0)
  total += statSync(out).size
  console.log(`  ${basename(out)} · ${kb} KB`)
}
console.log(`[gen-zodiac-png] OK · ${svgs.length} PNG · ${(total / 1024 / 1024).toFixed(1)} MB total`)
