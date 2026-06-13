/*
 * normalize-emblem.mjs — aplana un SVG de emblema crudo (export de
 * Illustrator: bloque <style> con clases .cls-N + class="cls-N" en
 * cada trazo) a un SVG con fills INLINE, que es lo que consume el
 * splitter (necesita un fill="#xxx" por elemento para la fase brasa).
 *
 * No reordena ni reescala: solo resuelve clase → color y limpia el
 * envoltorio (id/data-name/style block). Mantiene el viewBox tal cual.
 *
 * Uso: node scripts/normalize-emblem.mjs <src.svg> <out.svg>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [, , srcArg, outArg] = process.argv
if (!srcArg || !outArg) {
  console.error('uso: node scripts/normalize-emblem.mjs <src.svg> <out.svg>')
  process.exit(1)
}

const svg = readFileSync(srcArg, 'utf8')

// 1 · class → fill desde el bloque <style>.
const styleBlock = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
const classFill = new Map()
for (const m of styleBlock.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
  const fill = m[2].match(/fill:\s*([^;]+)\s*;?/)?.[1]?.trim()
  if (fill) classFill.set(m[1], fill)
}

const viewBox = svg.match(/viewBox="[^"]*"/)?.[0] ?? 'viewBox="0 0 1024 1024"'
const openTag = `<svg xmlns="http://www.w3.org/2000/svg" ${viewBox}>`

// 2 · cada path/polygon/circle: class="cls-N" → fill inline.
const els = [...svg.matchAll(/<(?:path|polygon|circle|rect|ellipse)\b[^>]*?\/>/g)].map((m) => {
  let el = m[0]
  const cls = el.match(/class="([^"]+)"/)?.[1]
  if (cls) {
    // Puede traer varias clases; toma la primera con fill conocido.
    const fill = cls.split(/\s+/).map((c) => classFill.get(c)).find(Boolean)
    el = el.replace(/\s*class="[^"]*"/, '')
    if (fill && !/fill="/.test(el)) el = el.replace(/\/>$/, ` fill="${fill}"/>`)
  }
  return el
})

writeFileSync(outArg, `${openTag}\n  ${els.join('\n  ')}\n</svg>\n`)
console.log(`${outArg} · ${els.length} elementos · ${classFill.size} clases resueltas`)
