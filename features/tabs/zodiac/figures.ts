import type { ZodiacDef, ZodiacSign } from './types'

/**
 * Hand-positioned zodiac silhouettes traced from the user's reference
 * image (12-constellation sketch sheet). Coords are [0..1] within the
 * LunarConstellation viewport.
 *
 * Magnitude convention here is iconographic, not astronomical:
 *   - 1.5  → "anchor" — the bigger star drawn in the reference
 *   - 1.8–2.0 → secondary anchor when an iconic constellation has two
 *   - 3.0  → mid asterisks along the silhouette
 *   - 4.0+ → faint connector points
 *
 * Acuario is the user-provided SVG (water-bearer figure) and must
 * stay byte-equivalent to that source — do not retune its coords.
 *
 * If you ever want astronomically accurate positions for a future
 * detail view, see `features/tabs/zodiac/astronomy/`.
 */
export const FIGURES: Record<ZodiacSign, ZodiacDef> = {
  // Aries — gentle zigzag arcing from upper-left down across to the
  // right, with one prominent star (Hamal) at the peak.
  aries: {
    label: 'ARIES',
    glyph: '♈',
    stars: [
      { x: 0.16, y: 0.4, mag: 3.5 }, // 0 leftmost small
      { x: 0.34, y: 0.22, mag: 1.5 }, // 1 anchor / Hamal
      { x: 0.5, y: 0.38, mag: 3.0 }, // 2 dip
      { x: 0.7, y: 0.55, mag: 3.0 }, // 3 mid-right
      { x: 0.88, y: 0.68, mag: 3.5 }, // 4 far right
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },

  // Taurus — Hyades V tilted, Aldebaran at the centre, horns
  // trailing to the upper-right.
  tauro: {
    label: 'TAURO',
    glyph: '♉',
    stars: [
      { x: 0.08, y: 0.45, mag: 3.5 }, // 0 left horn tip
      { x: 0.25, y: 0.52, mag: 3.0 }, // 1 V left
      { x: 0.42, y: 0.58, mag: 1.5 }, // 2 Aldebaran (anchor)
      { x: 0.32, y: 0.32, mag: 3.0 }, // 3 V upper
      { x: 0.55, y: 0.42, mag: 3.5 }, // 4 V apex / hinge
      { x: 0.7, y: 0.36, mag: 3.0 }, // 5 right branch
      { x: 0.86, y: 0.26, mag: 2.5 }, // 6 right horn tip
      { x: 0.78, y: 0.5, mag: 3.5 }, // 7 lower-right tail
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 4],
      [3, 4],
      [4, 5],
      [5, 6],
      [5, 7],
    ],
  },

  // Géminis — two stars at the top (Castor & Pollux), parallel bodies
  // trailing down-right and ending in feet.
  geminis: {
    label: 'GÉMINIS',
    glyph: '♊',
    stars: [
      { x: 0.18, y: 0.16, mag: 1.5 }, // 0 Castor (anchor)
      { x: 0.34, y: 0.22, mag: 1.5 }, // 1 Pollux (anchor)
      { x: 0.45, y: 0.38, mag: 3.0 }, // 2 mid-right joint
      { x: 0.6, y: 0.42, mag: 3.0 }, // 3
      { x: 0.78, y: 0.5, mag: 3.0 }, // 4
      { x: 0.92, y: 0.55, mag: 3.5 }, // 5 right tip
      { x: 0.5, y: 0.6, mag: 3.5 }, // 6 lower parallel
      { x: 0.72, y: 0.72, mag: 3.5 }, // 7 lower foot
    ],
    lines: [
      [0, 1],
      [0, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [1, 6],
      [6, 7],
      [3, 7],
    ],
  },

  // Cáncer — sparse Y with 5 faint stars. No bright anchor in
  // reality, but we keep one at the apex so the sparkle still fires.
  cancer: {
    label: 'CÁNCER',
    glyph: '♋',
    stars: [
      { x: 0.3, y: 0.22, mag: 3.0 }, // 0 top-left arm
      { x: 0.5, y: 0.36, mag: 1.9 }, // 1 apex (anchor)
      { x: 0.72, y: 0.22, mag: 3.0 }, // 2 top-right arm
      { x: 0.5, y: 0.58, mag: 3.0 }, // 3 stem mid
      { x: 0.5, y: 0.82, mag: 3.5 }, // 4 stem bottom
    ],
    lines: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
    ],
  },

  // Leo — sickle (backwards question-mark mane) anchored on Regulus,
  // body triangle extending to Denebola at the tail.
  leo: {
    label: 'LEO',
    glyph: '♌',
    stars: [
      { x: 0.1, y: 0.5, mag: 1.5 }, // 0 Regulus (anchor)
      { x: 0.14, y: 0.32, mag: 3.0 }, // 1 neck
      { x: 0.22, y: 0.18, mag: 3.0 }, // 2 sickle top-left
      { x: 0.34, y: 0.14, mag: 2.5 }, // 3 sickle top
      { x: 0.42, y: 0.26, mag: 3.0 }, // 4 sickle top-right
      { x: 0.34, y: 0.38, mag: 3.0 }, // 5 sickle inner / Algieba
      { x: 0.46, y: 0.56, mag: 3.0 }, // 6 back high
      { x: 0.68, y: 0.6, mag: 3.5 }, // 7 back
      { x: 0.88, y: 0.5, mag: 2.0 }, // 8 Denebola (anchor)
      { x: 0.72, y: 0.78, mag: 3.5 }, // 9 hind leg
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [0, 6],
      [6, 7],
      [7, 8],
      [7, 9],
    ],
  },

  // Virgo — radiating multi-armed figure with Spica anchoring the
  // bottom.
  virgo: {
    label: 'VIRGO',
    glyph: '♍',
    stars: [
      { x: 0.5, y: 0.08, mag: 3.0 }, // 0 head top
      { x: 0.32, y: 0.22, mag: 3.0 }, // 1 left arm out
      { x: 0.16, y: 0.36, mag: 3.5 }, // 2 left hand
      { x: 0.68, y: 0.22, mag: 3.0 }, // 3 right arm out
      { x: 0.86, y: 0.36, mag: 3.0 }, // 4 right hand
      { x: 0.5, y: 0.42, mag: 3.0 }, // 5 chest
      { x: 0.5, y: 0.62, mag: 3.0 }, // 6 waist
      { x: 0.32, y: 0.74, mag: 3.5 }, // 7 left hip
      { x: 0.68, y: 0.74, mag: 3.5 }, // 8 right hip
      { x: 0.5, y: 0.92, mag: 1.5 }, // 9 Spica (anchor)
    ],
    lines: [
      [0, 5],
      [5, 1],
      [1, 2],
      [5, 3],
      [3, 4],
      [5, 6],
      [6, 7],
      [6, 8],
      [7, 9],
      [8, 9],
    ],
  },

  // Libra — light Y/triangle with one bright star at the top apex.
  libra: {
    label: 'LIBRA',
    glyph: '♎',
    stars: [
      { x: 0.5, y: 0.12, mag: 1.8 }, // 0 top apex (anchor)
      { x: 0.2, y: 0.46, mag: 2.8 }, // 1 left tip
      { x: 0.8, y: 0.46, mag: 2.8 }, // 2 right tip
      { x: 0.36, y: 0.78, mag: 3.5 }, // 3 lower-left
      { x: 0.64, y: 0.78, mag: 3.5 }, // 4 lower-right
      { x: 0.5, y: 0.6, mag: 3.5 }, // 5 inner pivot
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 5],
      [1, 2],
    ],
  },

  // Escorpio — long S-curve from head with claws at the upper-left
  // down through Antares to a curled stinger.
  escorpio: {
    label: 'ESCORPIO',
    glyph: '♏',
    stars: [
      { x: 0.1, y: 0.2, mag: 3.0 }, // 0 left claw
      { x: 0.22, y: 0.3, mag: 3.0 }, // 1 head
      { x: 0.4, y: 0.18, mag: 3.0 }, // 2 right claw
      { x: 0.36, y: 0.42, mag: 3.0 }, // 3 body high
      { x: 0.5, y: 0.55, mag: 1.5 }, // 4 Antares (anchor)
      { x: 0.55, y: 0.72, mag: 3.0 }, // 5 body mid
      { x: 0.7, y: 0.82, mag: 3.0 }, // 6 body bend
      { x: 0.84, y: 0.78, mag: 3.0 }, // 7 tail curl
      { x: 0.9, y: 0.62, mag: 3.0 }, // 8 tail
      { x: 0.8, y: 0.45, mag: 2.0 }, // 9 stinger tip (anchor)
    ],
    lines: [
      [0, 1],
      [2, 1],
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
    ],
  },

  // Sagitario — the teapot asterism (spout, body, handle, lid).
  sagitario: {
    label: 'SAGITARIO',
    glyph: '♐',
    stars: [
      { x: 0.08, y: 0.5, mag: 3.0 }, // 0 spout tip
      { x: 0.24, y: 0.46, mag: 2.8 }, // 1 spout base
      { x: 0.2, y: 0.7, mag: 3.0 }, // 2 bottom-left
      { x: 0.5, y: 0.78, mag: 3.0 }, // 3 bottom-right
      { x: 0.6, y: 0.55, mag: 2.8 }, // 4 handle base
      { x: 0.84, y: 0.6, mag: 3.0 }, // 5 handle outer
      { x: 0.6, y: 0.3, mag: 2.8 }, // 6 top-right / lid base
      { x: 0.42, y: 0.18, mag: 1.9 }, // 7 lid top (anchor)
      { x: 0.28, y: 0.3, mag: 3.0 }, // 8 lid top-left
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [4, 6],
      [1, 8],
      [8, 7],
      [7, 6],
    ],
  },

  // Capricornio — wide curved wedge (sea-goat profile) from upper-
  // left around to lower-right.
  capricornio: {
    label: 'CAPRICORNIO',
    glyph: '♑',
    stars: [
      { x: 0.08, y: 0.32, mag: 3.0 }, // 0 left horn tip
      { x: 0.24, y: 0.22, mag: 2.5 }, // 1 top
      { x: 0.46, y: 0.18, mag: 3.0 }, // 2 top-mid
      { x: 0.7, y: 0.32, mag: 1.8 }, // 3 Deneb Algedi (anchor)
      { x: 0.84, y: 0.48, mag: 3.0 }, // 4 right
      { x: 0.66, y: 0.7, mag: 3.0 }, // 5 lower-right
      { x: 0.4, y: 0.78, mag: 3.0 }, // 6 lower-mid
      { x: 0.2, y: 0.6, mag: 3.0 }, // 7 lower-left
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
    ],
  },

  // Acuario — exact figure from the user-provided SVG. Do not retune.
  acuario: {
    label: 'ACUARIO',
    glyph: '♒',
    stars: [
      { x: 0.998, y: 0.998, mag: 3.5 }, // 0 right arm tip / foot
      { x: 0.765, y: 0.568, mag: 3.0 }, // 1 right elbow
      { x: 0.57, y: 0.181, mag: 1.5 }, // 2 shoulder / urn (anchor + branch)
      { x: 0.416, y: 0.155, mag: 2.5 }, // 3 upper torso
      { x: 0.387, y: 0.002, mag: 2.5 }, // 4 head top
      { x: 0.28, y: 0.04, mag: 3.5 }, // 5 head/neck
      { x: 0.002, y: 0.32, mag: 2.5 }, // 6 far-left arm tip
      { x: 0.148, y: 0.411, mag: 3.5 }, // 7 left elbow
      { x: 0.186, y: 0.668, mag: 3.5 }, // 8 hip
      { x: 0.094, y: 0.771, mag: 3.5 }, // 9 knee
      { x: 0.024, y: 0.944, mag: 3.5 }, // 10 foot
      { x: 0.449, y: 0.507, mag: 4.0 }, // 11 water stream upper
      { x: 0.474, y: 0.831, mag: 3.5 }, // 12 water stream lower
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10],
      [2, 11],
      [11, 12],
    ],
  },

  // Piscis — two fish on the horizon connected by a long cord that
  // dips into a knot at the lower-middle (Alrescha).
  piscis: {
    label: 'PISCIS',
    glyph: '♓',
    stars: [
      { x: 0.04, y: 0.22, mag: 3.0 }, // 0 left fish tail
      { x: 0.18, y: 0.16, mag: 2.8 }, // 1 left fish top
      { x: 0.3, y: 0.22, mag: 3.0 }, // 2 left fish nose
      { x: 0.2, y: 0.34, mag: 3.0 }, // 3 left fish bottom (cord attach)
      { x: 0.42, y: 0.58, mag: 3.5 }, // 4 cord mid-left
      { x: 0.52, y: 0.7, mag: 1.5 }, // 5 Alrescha knot (anchor)
      { x: 0.66, y: 0.46, mag: 3.5 }, // 6 cord mid-right
      { x: 0.78, y: 0.3, mag: 3.0 }, // 7 right fish near
      { x: 0.92, y: 0.18, mag: 2.8 }, // 8 right fish top
      { x: 0.96, y: 0.32, mag: 3.0 }, // 9 right fish far
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [7, 9],
    ],
  },
}
