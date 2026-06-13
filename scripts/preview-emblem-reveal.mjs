/*
 * preview-emblem-reveal.mjs — preview FIEL del reveal (espeja el shader
 * de RevealedEmblem: gate, feather, gain, edge, aspect real, placement)
 * sobre las imágenes reales, a varios %. Escribe /tmp/emblem-reveal.png.
 */
import { Buffer } from 'node:buffer'
import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { Resvg } from '@resvg/resvg-js'

const ART = new URL('../assets/zodiac-art/', import.meta.url)
const load = (f) => PNG.sync.read(readFileSync(new URL(f, ART)))
const arch = load('arch.png')
const lion = load('leo-c.png')

const S = 760
// Espejo de los consts del componente.
const ARCH_HFRAC = 0.98
const LION_WFRAC = 0.58
const LION_CX = 0.5
const LION_CY = 0.48
const MASTER = 0.9
const FEATHER = 0.06
const GAIN = 1.4
const EDGE_LO = 0.62
const EDGE_HI = 0.03
const BG = [10, 6, 8]

const edgeFor = (p, boost = 1) =>
  EDGE_LO - (EDGE_LO - EDGE_HI) * Math.min(1, (p / 100) * boost)
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Muestrea PNG premultiplicado en (X,Y) de lienzo según rect destino.
function sample(img, dst, X, Y) {
  if (X < dst.x || X >= dst.x + dst.w || Y < dst.y || Y >= dst.y + dst.h) return null
  const u = (X - dst.x) / dst.w
  const v = (Y - dst.y) / dst.h
  const sx = Math.min(img.width - 1, Math.floor(u * img.width))
  const sy = Math.min(img.height - 1, Math.floor(v * img.height))
  const i = (sy * img.width + sx) * 4
  const a = img.data[i + 3] / 255
  // premultiplicado: rgb * alpha
  return [img.data[i] * a, img.data[i + 1] * a, img.data[i + 2] * a]
}

function drawLayer(out, img, dst, edge) {
  for (let Y = 0; Y < S; Y++) {
    for (let X = 0; X < S; X++) {
      const c = sample(img, dst, X, Y)
      if (!c) continue
      const lum = (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255
      const gate = smoothstep(0.012, 0.04, lum)
      const reveal = smoothstep(edge, edge + FEATHER, lum)
      const a = gate * reveal * MASTER
      if (a <= 0) continue
      const o = (Y * S + X) * 4
      out[o] = Math.min(255, out[o] + c[0] * GAIN * a)
      out[o + 1] = Math.min(255, out[o + 1] + c[1] * GAIN * a)
      out[o + 2] = Math.min(255, out[o + 2] + c[2] * GAIN * a)
    }
  }
}

const archAR = arch.width / arch.height
const archH = S * ARCH_HFRAC
const archW = archH * archAR
const archDst = { x: (S - archW) / 2, y: (S - archH) / 2, w: archW, h: archH }
const lionAR = lion.width / lion.height
const lionW = S * LION_WFRAC
const lionH = lionW / lionAR
const lionDst = { x: LION_CX * S - lionW / 2, y: LION_CY * S - lionH / 2, w: lionW, h: lionH }

const STEPS = [0, 20, 40, 60, 80, 100]
const tiles = STEPS.map((p) => {
  const out = new Uint8ClampedArray(S * S * 4)
  for (let i = 0; i < S * S; i++) {
    out[i * 4] = BG[0]
    out[i * 4 + 1] = BG[1]
    out[i * 4 + 2] = BG[2]
    out[i * 4 + 3] = 255
  }
  drawLayer(out, arch, archDst, edgeFor(p, 2.2))
  drawLayer(out, lion, lionDst, edgeFor(p, 1))
  const png = new PNG({ width: S, height: S })
  png.data = Buffer.from(out.buffer)
  return { p, buf: PNG.sync.write(png) }
})

const TILE = 250
const W = TILE * STEPS.length
const H = TILE + 30
const montage = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#0A0608"/>
${tiles
  .map(
    ({ p, buf }, i) => `<image x="${i * TILE}" y="0" width="${TILE}" height="${TILE}" href="data:image/png;base64,${buf.toString('base64')}"/>
<text x="${i * TILE + TILE / 2}" y="${TILE + 20}" text-anchor="middle" font-family="Helvetica" font-size="18" fill="#F4ECDE">${p}%</text>`,
  )
  .join('\n')}
</svg>`
writeFileSync('/tmp/emblem-reveal.png', new Resvg(montage).render().asPng())
console.log('ok /tmp/emblem-reveal.png')
