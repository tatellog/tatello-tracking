/*
 * compose-emblem-preview.mjs — preview de composición arco + animal.
 * Prueba varias escalas del león dentro del aro para clavar los consts
 * de posición antes de cablear el componente Skia. No se commitea nada;
 * solo escribe /tmp/emblem-compose.png.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const ART = new URL('../assets/zodiac-art/', import.meta.url)
const b64 = (f) => readFileSync(new URL(f, ART)).toString('base64')
const ARCH = `data:image/png;base64,${b64('arch.png')}`
const LION = `data:image/png;base64,${b64('leo-c.png')}`

const S = 1000 // lienzo cuadrado de preview
// aspect ratios reales
const ARCH_AR = 2102 / 1712
const LION_AR = 1992 / 1658

// arco: fit-contain en el cuadrado (full width, centrado vertical)
const archW = S
const archH = S / ARCH_AR
const archY = (S - archH) / 2

// variantes de escala del león (fracción del ancho del lienzo) + offset Y
const VARIANTS = [
  { wFrac: 0.5, cy: 0.46, label: '0.50' },
  { wFrac: 0.56, cy: 0.46, label: '0.56' },
  { wFrac: 0.62, cy: 0.46, label: '0.62' },
]

function tile(v) {
  const lw = S * v.wFrac
  const lh = lw / LION_AR
  const lx = (S - lw) / 2
  const ly = v.cy * S - lh / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="#0A0608"/>
    <image x="0" y="${archY}" width="${archW}" height="${archH}" href="${ARCH}"/>
    <image x="${lx}" y="${ly}" width="${lw}" height="${lh}" href="${LION}"/>
  </svg>`
}

const TILE = 420
const pngs = VARIANTS.map((v) => ({
  v,
  png: new Resvg(tile(v), { fitTo: { mode: 'width', value: TILE } }).render().asPng(),
}))

const W = TILE * VARIANTS.length
const H = TILE + 34
const montage = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0A0608"/>
  ${pngs
    .map(
      ({ v, png }, i) => `<image x="${i * TILE}" y="0" width="${TILE}" height="${TILE}" href="data:image/png;base64,${png.toString('base64')}"/>
  <text x="${i * TILE + TILE / 2}" y="${TILE + 22}" text-anchor="middle" font-family="Helvetica" font-size="18" fill="#F4ECDE">león ${v.label}× ancho</text>`,
    )
    .join('\n')}
</svg>`
writeFileSync('/tmp/emblem-compose.png', new Resvg(montage).render().asPng())
console.log('ok /tmp/emblem-compose.png')
