/*
 * render-emblem-arc-all.mjs — montaje del arco de 5 etapas para cada
 * signo (capas genéricas marco/núcleo/detalle), espejando las
 * opacidades en reposo de RevealedEmblem. Una fila por signo.
 *
 * Uso: node scripts/render-emblem-arc-all.mjs [sign1 sign2 ...]
 *   sin args → los 10 signos cuadrados.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const ART = new URL('../assets/zodiac-art/', import.meta.url)
const BG = '#0A0608'
const EMBER = '#7A6034'
const MASTER = 0.72

const ALL = ['aries','tauro','geminis','virgo','libra','escorpio','sagitario','capricornio','acuario','piscis']
const signs = process.argv.slice(2).length ? process.argv.slice(2) : ALL

// Opacidades en reposo por etapa (espejo de RevealedEmblem, estructura
// genérica de 3 capas art + marco mono).
const STAGES = [
  { label: 'despierta', marcoMono: 0.55 },
  { label: 'forma', marcoArt: 0.55, nucleo: 0.75 },
  { label: 'revela', marcoArt: 0.7, nucleo: 0.9, detalle: 0.8 },
  { label: 'casi', marcoArt: 0.88, nucleo: 0.97, detalle: 0.92, glow: 0.35 },
  { label: 'completo', marcoArt: 1, nucleo: 1, detalle: 1, glow: 0.5 },
]

const inner = (file, color) => {
  const p = new URL(file, ART)
  if (!existsSync(p)) return ''
  let svg = readFileSync(p, 'utf8')
  if (color) svg = svg.replaceAll(/fill="[^"]*"/g, `fill="${color}"`)
  return svg.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
}

function stageSvg(sign, stage) {
  const L = {
    marcoMono: inner(`${sign}-emblem-marco-mono.svg`, EMBER),
    marcoArt: inner(`${sign}-emblem-marco.svg`),
    nucleo: inner(`${sign}-emblem-nucleo.svg`),
    detalle: inner(`${sign}-emblem-detalle.svg`),
  }
  const glow = stage.glow
    ? `<circle cx="512" cy="481" r="532" fill="url(#g)" opacity="${stage.glow}"/>`
    : ''
  const layers = ['marcoMono', 'marcoArt', 'nucleo', 'detalle']
    .filter((k) => stage[k])
    .map((k) => `<g opacity="${(stage[k] * MASTER).toFixed(3)}">${L[k]}</g>`)
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" fill="${BG}"/>
<defs><radialGradient id="g" cx="50%" cy="47%" r="52%">
<stop offset="0%" stop-color="#FFF6E5" stop-opacity="0.16"/>
<stop offset="45%" stop-color="#E8B872" stop-opacity="0.13"/>
<stop offset="75%" stop-color="#D9AE6F" stop-opacity="0.07"/>
<stop offset="100%" stop-color="#D9AE6F" stop-opacity="0"/>
</radialGradient></defs>
${glow}
${layers}
</svg>`
}

const TILE = 240
const LABEL_W = 110
const rowH = TILE
const W = LABEL_W + STAGES.length * TILE
const H = signs.length * rowH + 30

const rows = signs.map((sign, r) => {
  const tiles = STAGES.map((stage, c) => {
    const png = new Resvg(stageSvg(sign, stage), { fitTo: { mode: 'width', value: TILE } })
      .render().asPng()
    const x = LABEL_W + c * TILE
    const y = r * rowH
    return `<image x="${x}" y="${y}" width="${TILE}" height="${TILE}" href="data:image/png;base64,${png.toString('base64')}"/>`
  }).join('\n')
  const labelY = r * rowH + rowH / 2
  return `${tiles}
<text x="8" y="${labelY}" font-family="Helvetica" font-size="16" fill="#F4ECDE">${sign}</text>`
}).join('\n')

const header = STAGES.map((s, c) =>
  `<text x="${LABEL_W + c * TILE + TILE / 2}" y="${H - 10}" text-anchor="middle" font-family="Helvetica" font-size="14" fill="#8A7570">${s.label}</text>`
).join('\n')

const montage = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${BG}"/>
${rows}
${header}
</svg>`

writeFileSync('/tmp/emblems-arc-all.png', new Resvg(montage).render().asPng())
console.log(`/tmp/emblems-arc-all.png · ${signs.length} signos`)
