/*
 * Renderiza el arco de 5 etapas del Emblema Celeste de Leo como montaje
 * PNG, usando EXACTAMENTE las opacidades en reposo de RevealedLeoEmblem
 * (interpolaciones evaluadas en s = 0..4). Para previsualizar cambios de
 * mapeo capa→etapa sin abrir el simulador.
 *
 * Uso: node scripts/render-emblem-arc.mjs [outDir=/tmp]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const ART = join(import.meta.dirname, '..', 'assets', 'zodiac-art')
const OUT = process.argv[2] ?? '/tmp'

const BG = '#0A0608'
const EMBER = '#7A6034'
const MASTER = 0.72
const ORO = '#D9AE6F'
const ORO_SOFT = '#E8B872'
const ORO_LECHE = '#FFF6E5'

// Espejo de las interpolaciones de RevealedLeoEmblem.tsx evaluadas en
// los valores enteros de etapa (reposo). Si cambias el componente,
// cambia esta tabla.
const STAGES = [
  { label: 'despierta 0-25', marcoMono: 0.55 },
  { label: 'forma 26-50', marcoArt: 0.55, jardinMono: 0.6, cabezaArt: 0.75 },
  { label: 'revela 51-75', marcoArt: 0.65, jardinArt: 0.65, cabezaArt: 0.85, melenaArt: 0.8 },
  { label: 'casi 76-99', marcoArt: 0.85, jardinArt: 0.85, cabezaArt: 0.95, melenaArt: 0.9, glow: 0.35 },
  { label: 'completo 100', marcoArt: 1, jardinArt: 1, cabezaArt: 1, melenaArt: 1, glow: 0.5 },
]

const inner = (file, color) => {
  let svg = readFileSync(join(ART, file), 'utf8')
  if (color) svg = svg.replaceAll('currentColor', color)
  return svg
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
}

const LAYERS = {
  marcoMono: inner('leo-emblem-marco-mono.svg', EMBER),
  marcoArt: inner('leo-emblem-marco.svg'),
  jardinMono: inner('leo-emblem-jardin-mono.svg', EMBER),
  jardinArt: inner('leo-emblem-jardin.svg'),
  cabezaArt: inner('leo-emblem-cabeza.svg'),
  melenaArt: inner('leo-emblem-melena.svg'),
}

function stageSvg(stage) {
  const glow = stage.glow
    ? `<circle cx="512" cy="481" r="532" fill="url(#glow)" opacity="${stage.glow}"/>`
    : ''
  const layers = Object.keys(LAYERS)
    .filter((k) => stage[k])
    .map((k) => `<g opacity="${(stage[k] * MASTER).toFixed(3)}">${LAYERS[k]}</g>`)
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" fill="${BG}"/>
<defs><radialGradient id="glow" cx="50%" cy="47%" r="52%">
<stop offset="0%" stop-color="${ORO_LECHE}" stop-opacity="0.16"/>
<stop offset="45%" stop-color="${ORO_SOFT}" stop-opacity="0.13"/>
<stop offset="75%" stop-color="${ORO}" stop-opacity="0.07"/>
<stop offset="100%" stop-color="${ORO}" stop-opacity="0"/>
</radialGradient></defs>
${glow}
${layers}
</svg>`
}

const TILE = 360
const pngs = STAGES.map((stage, i) => {
  const png = new Resvg(stageSvg(stage), {
    fitTo: { mode: 'width', value: TILE },
  }).render().asPng()
  writeFileSync(join(OUT, `leo-etapa-${i + 1}-${stage.label.split(' ')[0]}.png`), png)
  return png
})

// Montaje horizontal con etiquetas.
const montage = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE * 5}" height="${TILE + 44}">
<rect width="${TILE * 5}" height="${TILE + 44}" fill="${BG}"/>
${pngs
  .map(
    (png, i) => `<image x="${i * TILE}" y="0" width="${TILE}" height="${TILE}"
  href="data:image/png;base64,${png.toString('base64')}"/>
<text x="${i * TILE + TILE / 2}" y="${TILE + 28}" text-anchor="middle"
  font-family="Helvetica" font-size="20" fill="#F4ECDE">${STAGES[i].label}</text>`,
  )
  .join('\n')}
</svg>`

writeFileSync(join(OUT, 'leo-arco.png'), new Resvg(montage).render().asPng())
console.log(`listo → ${OUT}/leo-arco.png + 5 etapas`)
