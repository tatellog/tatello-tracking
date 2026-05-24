import { Circle, G, Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Static layers of the orbital constellation
 * (daily_constellation.svg). Source viewBox 1024 × 1024.
 *
 * Split into Back + Front so AnimatedConstellation can interleave
 * its travelling-particle orbits between them, matching the source
 * SVG's z-order:
 *
 *   1. outer concentric rings + axis cross  (Back)
 *   2. orbit rings with particles           (AnimatedConstellation)
 *   3. spokes + node frames + ornaments + sparks (Front)
 *   4. dimension star nodes                 (StarNode / DecorativeStar in OrbitalSystem)
 *
 * The SVG's central star ornament, node frame rings, and in-node
 * symbols overlap with the live luminous bodies (DecorativeStar +
 * StarNode), so we skip the brightest ones — only the faint outer
 * node frames + the central star's outer circle remain as
 * decorative shadow under the live stars. Everything is painted in
 * `colors.magenta` at the source's authored opacities so the figure
 * sits inside STELAR's palette while preserving the source
 * structure.
 */

const STROKE = colors.magenta

// Six dimension node positions + the centre. Used by the Front
// layer to draw the outer node frame ring.
//
// Order matches CLOCKWISE: top → upper-right → lower-right →
// bottom → lower-left → upper-left.
const NODE_POS = [
  { x: 512, y: 210 }, // mente
  { x: 773.5, y: 361 }, // sueno
  { x: 773.5, y: 663 }, // alimento
  { x: 512, y: 814 }, // ciclo
  { x: 250.5, y: 663 }, // energia
  { x: 250.5, y: 361 }, // cuerpo
] as const

export function ConstellationDrawingBack() {
  return (
    <>
      {/* Six concentric outer rings — the orbital "shells" the
          figure sits inside. Stroke + opacity ramps so the outer
          ring reads as the boundary and the inner ones fade
          progressively, building depth toward the centre. */}
      <G stroke={STROKE} fill="none" strokeLinecap="round">
        <Circle cx={512} cy={512} r={430} strokeWidth={2} />
        <Circle cx={512} cy={512} r={397} strokeWidth={1.2} opacity={0.8} />
        <Circle cx={512} cy={512} r={354} strokeWidth={1} opacity={0.65} />
        <Circle cx={512} cy={512} r={301} strokeWidth={0.9} opacity={0.45} />
        <Circle cx={512} cy={512} r={244} strokeWidth={0.8} opacity={0.35} />
        <Circle cx={512} cy={512} r={185} strokeWidth={0.8} opacity={0.3} />
      </G>
      {/* Axis cross + two diagonals — the compass of the astrolabe. */}
      <G stroke={STROKE} fill="none" strokeLinecap="round">
        <Path d="M512 57 V967" strokeWidth={1.4} opacity={0.85} />
        <Path d="M57 512 H967" strokeWidth={1.4} opacity={0.85} />
        <Path d="M190.5 190.5 L833.5 833.5" strokeWidth={1} opacity={0.5} />
        <Path d="M833.5 190.5 L190.5 833.5" strokeWidth={1} opacity={0.5} />
      </G>
    </>
  )
}

export function ConstellationDrawingFront() {
  return (
    <>
      {/* Spokes — five lines from the centre out to non-bottom
          nodes (the bottom spoke is just the vertical axis above).
          Drawn faintly so the bright StarNode + DecorativeStar
          remain the focal points; these read as "guidance rays"
          connecting the centre to every dimension. */}
      <G stroke={STROKE} fill="none" strokeLinecap="round" opacity={0.55} strokeWidth={1.2}>
        <Path d="M512 210 L512 512 L773.5 361" />
        <Path d="M512 512 L773.5 663" />
        <Path d="M512 512 L512 814" />
        <Path d="M512 512 L250.5 663" />
        <Path d="M512 512 L250.5 361" />
      </G>

      {/* Central star ornament — two concentric circles + a small
          4-point star + two short axis stubs. Sits BEHIND the
          DecorativeStar's lens flare so it reads as the engraved
          medallion the bright centre star rests inside. The
          DecorativeStar fades to ~10 % at zoom, so this ornament
          stays visible during zoom — but scaffoldDim drops it to
          ~6 % too, keeping the focus on the selected star. */}
      <G stroke={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}>
        <Circle cx={512} cy={512} r={66} />
        <Circle cx={512} cy={512} r={43} opacity={0.6} />
        <Path d="M512 427 L527 497 L597 512 L527 527 L512 597 L497 527 L427 512 L497 497 Z" />
        <Path d="M512 466 V558" opacity={0.9} />
        <Path d="M466 512 H558" opacity={0.9} />
      </G>

      {/* Outer node frame — a single ring around each dimension
          node. The two inner rings (r=34, r=18) and the in-node
          symbols are intentionally OMITTED: they all fall inside
          StarNode's bloom radius and combined with it to look
          busy. The single outer ring (r=48) reads as a thin
          medallion behind the bright luminous star. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.5} opacity={0.55}>
        {NODE_POS.map((p, i) => (
          <Circle key={`nr-${i}`} cx={p.x} cy={p.y} r={48} />
        ))}
      </G>

      {/* Beads — small filled dots punctuating the spokes. Like the
          minor planets that mark the orbital paths. */}
      <G fill={STROKE}>
        <Circle cx={512} cy={355} r={4} />
        <Circle cx={512} cy={669} r={4} />
        <Circle cx={638} cy={438} r={4} />
        <Circle cx={638} cy={586} r={4} />
        <Circle cx={386} cy={438} r={4} />
        <Circle cx={386} cy={586} r={4} />
        <Circle cx={642.8} cy={285.5} r={4} />
        <Circle cx={642.8} cy={738.5} r={4} />
        <Circle cx={381.2} cy={285.5} r={4} />
        <Circle cx={381.2} cy={738.5} r={4} />
      </G>

      {/* Cardinal ornaments — four diamond tips + four small
          circles at the cardinal directions of the outermost
          ring. Markers of N/E/S/W on the astrolabe. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M512 37 L521 57 L512 77 L503 57 Z" />
        <Path d="M512 947 L521 967 L512 987 L503 967 Z" />
        <Path d="M37 512 L57 503 L77 512 L57 521 Z" />
        <Path d="M947 512 L967 503 L987 512 L967 521 Z" />
        <Circle cx={512} cy={113} r={8} />
        <Circle cx={512} cy={911} r={8} />
        <Circle cx={113} cy={512} r={8} />
        <Circle cx={911} cy={512} r={8} />
      </G>

      {/* Corner sparks — four "+" marks + four small filled dots
          scattered in the ambient field outside the orbit rings. */}
      <G stroke={STROKE} fill="none" strokeWidth={1} strokeLinecap="round" opacity={0.7}>
        <Path d="M182 205 V229 M170 217 H194" />
        <Path d="M842 205 V229 M830 217 H854" />
        <Path d="M182 795 V819 M170 807 H194" />
        <Path d="M842 795 V819 M830 807 H854" />
      </G>
      <G fill={STROKE} opacity={0.7}>
        <Circle cx={177} cy={332} r={4} />
        <Circle cx={847} cy={332} r={4} />
        <Circle cx={177} cy={692} r={4} />
        <Circle cx={847} cy={692} r={4} />
      </G>
    </>
  )
}
