import type { ZodiacDef, ZodiacSign } from './types'

/**
 * Hand-positioned HA Rey-style stylised figures, one per zodiac
 * sign. Coords are [0..1] within the LunarConstellation viewport
 * (LunarConstellation already insets the canvas by PAD on each side,
 * so designs can hug 0 and 1 without clipping).
 *
 * Magnitude convention here is iconographic, not astronomical:
 *   - 1.5  → "anchor" star (heart, eye, head) — fires the sparkle
 *   - 2.5  → key joints
 *   - 3.5  → limbs / minor anchors
 *   - 4.0+ → connector points
 *
 * If you want astronomically-accurate positions for a future detail
 * view, see `features/tabs/zodiac/astronomy/`.
 */
export const FIGURES: Record<ZodiacSign, ZodiacDef> = {
  // Aries — ram profile with curled horn
  aries: {
    label: 'ARIES',
    glyph: '♈',
    stars: [
      { x: 0.18, y: 0.46, mag: 3.5 }, // 0 left ear/horn tip
      { x: 0.3, y: 0.3, mag: 2.5 }, // 1 horn curl top
      { x: 0.45, y: 0.22, mag: 2.5 }, // 2 between horns / top of head
      { x: 0.55, y: 0.18, mag: 1.5 }, // 3 right horn tip (anchor)
      { x: 0.42, y: 0.42, mag: 3.0 }, // 4 forehead/eye
      { x: 0.57, y: 0.5, mag: 3.0 }, // 5 snout
      { x: 0.52, y: 0.62, mag: 3.5 }, // 6 neck
      { x: 0.72, y: 0.6, mag: 3.5 }, // 7 back high
      { x: 0.88, y: 0.7, mag: 4.0 }, // 8 tail
      { x: 0.58, y: 0.88, mag: 4.0 }, // 9 leg/belly
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 5],
      [2, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [6, 9],
    ],
  },

  // Taurus — bull V-face + horns + Pleiades cluster
  tauro: {
    label: 'TAURO',
    glyph: '♉',
    stars: [
      { x: 0.08, y: 0.18, mag: 2.5 }, // 0 left horn tip
      { x: 0.3, y: 0.34, mag: 3.0 }, // 1 left V branch
      { x: 0.5, y: 0.55, mag: 1.5 }, // 2 V apex (Aldebaran — anchor)
      { x: 0.7, y: 0.34, mag: 3.0 }, // 3 right V branch
      { x: 0.92, y: 0.18, mag: 2.5 }, // 4 right horn tip
      { x: 0.5, y: 0.74, mag: 3.5 }, // 5 neck/chest below face
      { x: 0.4, y: 0.92, mag: 4.0 }, // 6 front leg
      { x: 0.65, y: 0.92, mag: 4.0 }, // 7 back leg
      { x: 0.18, y: 0.08, mag: 3.5 }, // 8 Pleiades cluster left
      { x: 0.22, y: 0.04, mag: 4.0 }, // 9 Pleiades cluster top
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [5, 6],
      [5, 7],
      [8, 9],
    ],
  },

  // Géminis — two parallel humanoid figures linked at the heads and at the arms
  geminis: {
    label: 'GÉMINIS',
    glyph: '♊',
    stars: [
      { x: 0.3, y: 0.1, mag: 1.5 }, // 0 left head (Castor — anchor)
      { x: 0.3, y: 0.34, mag: 2.5 }, // 1 left shoulders
      { x: 0.26, y: 0.62, mag: 3.0 }, // 2 left waist
      { x: 0.32, y: 0.92, mag: 3.5 }, // 3 left foot
      { x: 0.7, y: 0.1, mag: 1.5 }, // 4 right head (Pollux — anchor)
      { x: 0.7, y: 0.34, mag: 2.5 }, // 5 right shoulders
      { x: 0.74, y: 0.62, mag: 3.0 }, // 6 right waist
      { x: 0.68, y: 0.92, mag: 3.5 }, // 7 right foot
      { x: 0.44, y: 0.42, mag: 4.0 }, // 8 arm bridge left
      { x: 0.56, y: 0.42, mag: 4.0 }, // 9 arm bridge right
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [4, 5],
      [5, 6],
      [6, 7],
      [0, 4],
      [1, 8],
      [8, 9],
      [9, 5],
    ],
  },

  // Cáncer — round body with two claws and two trailing legs
  cancer: {
    label: 'CÁNCER',
    glyph: '♋',
    stars: [
      { x: 0.4, y: 0.32, mag: 3.5 }, // 0 body top-left
      { x: 0.6, y: 0.32, mag: 3.5 }, // 1 body top-right
      { x: 0.7, y: 0.5, mag: 3.0 }, // 2 body right
      { x: 0.6, y: 0.68, mag: 3.5 }, // 3 body bottom-right
      { x: 0.4, y: 0.68, mag: 3.5 }, // 4 body bottom-left
      { x: 0.3, y: 0.5, mag: 3.0 }, // 5 body left
      { x: 0.22, y: 0.16, mag: 1.8 }, // 6 left claw tip (anchor)
      { x: 0.78, y: 0.16, mag: 2.5 }, // 7 right claw tip
      { x: 0.14, y: 0.86, mag: 3.5 }, // 8 left leg
      { x: 0.86, y: 0.86, mag: 3.5 }, // 9 right leg
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [0, 6],
      [1, 7],
      [4, 8],
      [3, 9],
    ],
  },

  // Leo — sickle (backward question-mark mane) anchored on Regulus + body triangle
  leo: {
    label: 'LEO',
    glyph: '♌',
    stars: [
      { x: 0.18, y: 0.46, mag: 1.5 }, // 0 Regulus (heart — anchor)
      { x: 0.2, y: 0.3, mag: 3.0 }, // 1 neck
      { x: 0.28, y: 0.18, mag: 3.5 }, // 2 mane top-left
      { x: 0.42, y: 0.1, mag: 2.5 }, // 3 mane top
      { x: 0.54, y: 0.16, mag: 3.0 }, // 4 mane top-right
      { x: 0.5, y: 0.32, mag: 3.5 }, // 5 back of head
      { x: 0.4, y: 0.42, mag: 2.5 }, // 6 chin / Algieba
      { x: 0.5, y: 0.6, mag: 2.5 }, // 7 back high
      { x: 0.78, y: 0.58, mag: 3.0 }, // 8 back end
      { x: 0.9, y: 0.42, mag: 2.0 }, // 9 Denebola (tail tip)
      { x: 0.75, y: 0.82, mag: 4.0 }, // 10 hind leg
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 0],
      [0, 7],
      [7, 8],
      [8, 9],
      [8, 10],
    ],
  },

  // Virgo — female figure with arms extended, holding wheat
  virgo: {
    label: 'VIRGO',
    glyph: '♍',
    stars: [
      { x: 0.5, y: 0.08, mag: 3.0 }, // 0 head
      { x: 0.5, y: 0.32, mag: 2.5 }, // 1 chest
      { x: 0.3, y: 0.3, mag: 3.5 }, // 2 left arm out
      { x: 0.14, y: 0.46, mag: 3.5 }, // 3 left hand
      { x: 0.7, y: 0.3, mag: 3.5 }, // 4 right arm out
      { x: 0.86, y: 0.46, mag: 3.0 }, // 5 right hand (wheat)
      { x: 0.5, y: 0.56, mag: 3.0 }, // 6 waist
      { x: 0.36, y: 0.78, mag: 3.5 }, // 7 left hip/leg
      { x: 0.64, y: 0.78, mag: 3.5 }, // 8 right hip/leg
      { x: 0.5, y: 0.94, mag: 1.5 }, // 9 Spica (feet — anchor)
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
      [4, 5],
      [1, 6],
      [6, 7],
      [6, 8],
      [7, 9],
      [8, 9],
    ],
  },

  // Libra — balance scale: vertical pole, horizontal beam, two pans
  libra: {
    label: 'LIBRA',
    glyph: '♎',
    stars: [
      { x: 0.5, y: 0.18, mag: 1.8 }, // 0 top of pole (anchor)
      { x: 0.5, y: 0.88, mag: 3.5 }, // 1 bottom anchor
      { x: 0.18, y: 0.22, mag: 2.5 }, // 2 left beam tip
      { x: 0.82, y: 0.22, mag: 2.5 }, // 3 right beam tip
      { x: 0.18, y: 0.55, mag: 3.5 }, // 4 left chain bottom
      { x: 0.82, y: 0.55, mag: 3.5 }, // 5 right chain bottom
      { x: 0.06, y: 0.72, mag: 4.0 }, // 6 left pan left
      { x: 0.3, y: 0.72, mag: 4.0 }, // 7 left pan right
      { x: 0.7, y: 0.72, mag: 4.0 }, // 8 right pan left
      { x: 0.94, y: 0.72, mag: 4.0 }, // 9 right pan right
    ],
    lines: [
      [0, 1],
      [2, 0],
      [0, 3],
      [2, 4],
      [3, 5],
      [4, 6],
      [4, 7],
      [6, 7],
      [5, 8],
      [5, 9],
      [8, 9],
    ],
  },

  // Escorpio — head with two claws + curving body + curled tail/stinger
  escorpio: {
    label: 'ESCORPIO',
    glyph: '♏',
    stars: [
      { x: 0.18, y: 0.18, mag: 3.0 }, // 0 left claw tip
      { x: 0.3, y: 0.3, mag: 2.5 }, // 1 head/neck
      { x: 0.45, y: 0.18, mag: 3.0 }, // 2 right claw tip
      { x: 0.5, y: 0.32, mag: 3.5 }, // 3 body high
      { x: 0.62, y: 0.45, mag: 3.0 }, // 4 body
      { x: 0.7, y: 0.6, mag: 1.5 }, // 5 Antares (heart — anchor)
      { x: 0.6, y: 0.76, mag: 3.0 }, // 6 body bend
      { x: 0.42, y: 0.86, mag: 3.0 }, // 7 tail base
      { x: 0.22, y: 0.84, mag: 3.5 }, // 8 tail curl
      { x: 0.1, y: 0.7, mag: 3.0 }, // 9 stinger curl middle
      { x: 0.2, y: 0.52, mag: 2.5 }, // 10 stinger tip
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
      [9, 10],
    ],
  },

  // Sagitario — the "teapot" asterism (spout, body, handle, lid)
  sagitario: {
    label: 'SAGITARIO',
    glyph: '♐',
    stars: [
      { x: 0.1, y: 0.5, mag: 3.0 }, // 0 spout tip
      { x: 0.28, y: 0.46, mag: 2.5 }, // 1 spout base
      { x: 0.3, y: 0.7, mag: 3.0 }, // 2 bottom-left of teapot
      { x: 0.58, y: 0.78, mag: 3.0 }, // 3 bottom-right
      { x: 0.66, y: 0.55, mag: 2.5 }, // 4 handle base
      { x: 0.88, y: 0.58, mag: 3.0 }, // 5 handle tip outer
      { x: 0.66, y: 0.3, mag: 2.5 }, // 6 top-right / lid base
      { x: 0.48, y: 0.18, mag: 1.5 }, // 7 lid top (anchor)
      { x: 0.32, y: 0.3, mag: 3.0 }, // 8 lid top-left
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

  // Capricornio — goat head + body tapering into a fish tail
  capricornio: {
    label: 'CAPRICORNIO',
    glyph: '♑',
    stars: [
      { x: 0.08, y: 0.32, mag: 3.0 }, // 0 left horn / head tip
      { x: 0.22, y: 0.2, mag: 2.5 }, // 1 top of head
      { x: 0.4, y: 0.32, mag: 3.5 }, // 2 back of head (eye area)
      { x: 0.55, y: 0.46, mag: 2.5 }, // 3 shoulder
      { x: 0.7, y: 0.58, mag: 1.5 }, // 4 back / Deneb Algedi (anchor)
      { x: 0.82, y: 0.72, mag: 3.0 }, // 5 fish transition
      { x: 0.88, y: 0.88, mag: 3.5 }, // 6 fish tail outer
      { x: 0.7, y: 0.92, mag: 3.5 }, // 7 fish tail lower
      { x: 0.3, y: 0.58, mag: 4.0 }, // 8 front leg
      { x: 0.5, y: 0.76, mag: 4.0 }, // 9 belly
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [3, 8],
      [4, 9],
      [9, 5],
    ],
  },

  // Acuario — exact figure from the user-provided SVG (water-bearer
  // with arms extended + water stream pouring down centre).
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

  // Piscis — two fish, each a closed quad, linked by a V-cord
  piscis: {
    label: 'PISCIS',
    glyph: '♓',
    stars: [
      { x: 0.08, y: 0.22, mag: 3.5 }, // 0 left fish tail
      { x: 0.22, y: 0.12, mag: 2.5 }, // 1 left fish top
      { x: 0.32, y: 0.22, mag: 3.0 }, // 2 left fish nose
      { x: 0.2, y: 0.32, mag: 3.0 }, // 3 left fish bottom / cord attach
      { x: 0.78, y: 0.16, mag: 3.0 }, // 4 right fish tail
      { x: 0.92, y: 0.24, mag: 2.5 }, // 5 right fish nose
      { x: 0.84, y: 0.4, mag: 3.0 }, // 6 right fish bottom
      { x: 0.7, y: 0.3, mag: 3.5 }, // 7 right fish near-side / cord attach
      { x: 0.5, y: 0.7, mag: 1.5 }, // 8 cord knot (Alrescha — anchor)
      { x: 0.5, y: 0.92, mag: 3.5 }, // 9 bottom anchor
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [3, 8],
      [7, 8],
      [8, 9],
    ],
  },
}
