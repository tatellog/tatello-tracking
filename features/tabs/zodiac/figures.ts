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
  // Aries — a six-star wave: a gentle dip on the left, a rise to
  // bright Hamal at the peak, then a long curving descent to the
  // lower-right tail. The peak sits above the centre counter and the
  // line drapes around it — nothing crosses the number.
  aries: {
    label: 'ARIES',
    glyph: '♈',
    stars: [
      { x: 0.09, y: 0.46, mag: 2.6 }, // 0 far-left — second brightest
      { x: 0.25, y: 0.55, mag: 3.4 }, // 1 dip
      { x: 0.42, y: 0.25, mag: 1.5 }, // 2 Hamal — the peak (anchor)
      { x: 0.66, y: 0.36, mag: 2.9 }, // 3 shoulder
      { x: 0.8, y: 0.58, mag: 3.0 }, // 4 descent
      { x: 0.91, y: 0.8, mag: 3.3 }, // 5 tail tip
    ],
    lines: [
      [0, 1],
      [1, 2], // rise to Hamal
      [2, 3], // curving descent
      [3, 4],
      [4, 5],
    ],
  },

  // Taurus — the bull: two horns reaching up-left, the Hyades V of
  // the face cascading down the centre, Aldebaran blazing as the eye,
  // and the body trailing to the lower-right.
  tauro: {
    label: 'TAURO',
    glyph: '♉',
    stars: [
      { x: 0.2, y: 0.08, mag: 2.0 }, // 0 top horn tip
      { x: 0.46, y: 0.35, mag: 3.0 }, // 1 top horn base
      { x: 0.06, y: 0.31, mag: 3.0 }, // 2 left horn tip
      { x: 0.38, y: 0.62, mag: 3.0 }, // 3 left horn base
      { x: 0.49, y: 0.46, mag: 4.0 }, // 4 Hyades V — upper
      { x: 0.44, y: 0.54, mag: 4.0 }, // 5 Hyades V — mid
      { x: 0.52, y: 0.61, mag: 4.0 }, // 6 Hyades V — lower
      { x: 0.57, y: 0.69, mag: 3.0 }, // 7 face hinge
      { x: 0.69, y: 0.81, mag: 1.5 }, // 8 Aldebaran (anchor / the eye)
      { x: 0.89, y: 0.73, mag: 3.2 }, // 9 body
      { x: 0.92, y: 0.93, mag: 3.5 }, // 10 body tip
    ],
    lines: [
      [0, 1], // top horn
      [2, 3], // left horn
      [1, 4], // top horn base into the Hyades V
      [4, 5],
      [5, 6],
      [6, 7], // V down to the face hinge
      [3, 7], // left horn base to the hinge
      [7, 8], // hinge to Aldebaran
      [8, 9], // Aldebaran into the body
      [9, 10], // body tip
    ],
  },

  // Géminis — the twins Castor & Pollux: two parallel horizontal
  // bodies, bright heads at the left, bodies extending right. Joined
  // by one vertical line (the twins' clasped hands). Unique among the
  // signs: NO fuchsia alpha — both heads are equal sibling stars, so
  // they stay cream. Heads are mag 1.9 (above HERO_MAG 1.7) precisely
  // so the hero glow never fires for this figure.
  // Coords normalised from the reference spec (viewBox 300×260).
  geminis: {
    label: 'GÉMINIS',
    glyph: '♊',
    stars: [
      // Castor — the upper twin, left to right
      { x: 0.167, y: 0.26, mag: 1.9 }, // 0 castor_head
      { x: 0.383, y: 0.32, mag: 3.2 }, // 1 castor_body_1
      { x: 0.583, y: 0.36, mag: 3.2 }, // 2 castor_body_2
      { x: 0.767, y: 0.34, mag: 3.2 }, // 3 castor_foot
      // Pollux — the lower twin, left to right
      { x: 0.2, y: 0.56, mag: 1.9 }, // 4 pollux_head
      { x: 0.417, y: 0.62, mag: 3.2 }, // 5 pollux_body_1
      { x: 0.617, y: 0.66, mag: 3.2 }, // 6 pollux_body_2
      { x: 0.817, y: 0.66, mag: 3.2 }, // 7 pollux_foot
      { x: 0.9, y: 0.73, mag: 3.2 }, // 8 pollux_extra
    ],
    lines: [
      [0, 1], // Castor's body
      [1, 2],
      [2, 3],
      [4, 5], // Pollux's body
      [5, 6],
      [6, 7],
      [7, 8],
      [1, 5], // the clasped hands — vertical join between the twins
      [0, 4], // closing edge — heads
      [3, 7], // closing edge — feet
    ],
  },

  // Cáncer — sparse Y with 5 faint stars. No bright anchor in
  // reality, but we keep one at the apex so the sparkle still fires.
  // Cáncer — the crab as an inverted Y: two arms bowing gently up and
  // out from a bright fuchsia junction, and a stem dropping to a
  // forked pair of claws below the counter. The forked base mirrors
  // the two raised arms so the figure reads balanced top-to-bottom
  // rather than as a lonely stem dangling off the apex.
  cancer: {
    label: 'CÁNCER',
    glyph: '♋',
    stars: [
      { x: 0.2, y: 0.18, mag: 2.8 }, // 0 left arm tip
      { x: 0.34, y: 0.25, mag: 3.2 }, // 1 left arm mid (bows up)
      { x: 0.5, y: 0.37, mag: 1.5 }, // 2 junction (anchor)
      { x: 0.66, y: 0.25, mag: 3.2 }, // 3 right arm mid (bows up)
      { x: 0.8, y: 0.17, mag: 2.8 }, // 4 right arm tip
      { x: 0.5, y: 0.62, mag: 3.2 }, // 5 stem mid
      { x: 0.36, y: 0.82, mag: 3.0 }, // 6 left claw
      { x: 0.63, y: 0.84, mag: 3.0 }, // 7 right claw
    ],
    lines: [
      [0, 1], // left arm
      [1, 2],
      [2, 3], // right arm
      [3, 4],
      [2, 5], // stem
      [5, 6], // claws
      [5, 7],
    ],
  },

  // Leo — sickle (backwards question-mark mane) anchored on Regulus,
  // body triangle extending to Denebola at the tail.
  // Leo — the sickle (an open backwards-question-mark hook for the
  // head and mane, anchored on bright Regulus) plus the hindquarters
  // triangle trailing right to Denebola at the tail. The lion's back
  // (Algieba → Zosma) arcs above the centre counter; only the belly
  // line (Regulus → Chort) passes behind it.
  leo: {
    label: 'LEO',
    glyph: '♌',
    stars: [
      // The sickle — open hook, Regulus at its base
      { x: 0.16, y: 0.52, mag: 1.5 }, // 0 Regulus (anchor)
      { x: 0.2, y: 0.4, mag: 3.2 }, // 1 Eta
      { x: 0.24, y: 0.28, mag: 2.4 }, // 2 Algieba — the bend
      { x: 0.2, y: 0.18, mag: 3.2 }, // 3 Adhafera
      { x: 0.3, y: 0.12, mag: 3.2 }, // 4 Rasalas
      { x: 0.42, y: 0.16, mag: 2.8 }, // 5 Epsilon — open end
      // The hindquarters triangle
      { x: 0.56, y: 0.6, mag: 3.2 }, // 6 Chort
      { x: 0.6, y: 0.4, mag: 2.8 }, // 7 Zosma
      { x: 0.86, y: 0.52, mag: 2.0 }, // 8 Denebola — the tail
    ],
    lines: [
      [0, 1], // sickle hook
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [6, 7], // hindquarters triangle
      [7, 8],
      [6, 8],
      [0, 6], // belly
      [2, 7], // back
    ],
  },

  // Virgo — radiating multi-armed figure with Spica anchoring the
  // bottom.
  // Virgo — the canonical figure. The body is a FIVE-sided pentagon
  // C-D-F-G-E: top edge C-D, a right side that bends at the knee F
  // (D-F runs near-vertical, F-G kicks out to the wider bottom-right
  // corner G), bottom edge G-E, left edge E-C. The pentagon frames
  // the counter in its interior — no star or line touches the number.
  // Four branches: antenna off C, arm off D up to a corner, left leg
  // off the central node E, and the forked lower-right leg off G.
  // C (the biggest star) anchors as the fuchsia hero.
  virgo: {
    label: 'VIRGO',
    glyph: '♍',
    stars: [
      { x: 0.22, y: 0.1, mag: 3.4 }, // 0 H — antenna tip
      { x: 0.4, y: 0.2, mag: 1.5 }, // 1 C — pentagon top-left (anchor)
      { x: 0.63, y: 0.28, mag: 3.0 }, // 2 D — pentagon top-right
      { x: 0.78, y: 0.15, mag: 3.2 }, // 3 B — arm
      { x: 0.92, y: 0.05, mag: 3.4 }, // 4 A — arm tip
      { x: 0.66, y: 0.47, mag: 3.4 }, // 5 F — pentagon right knee
      { x: 0.71, y: 0.69, mag: 1.9 }, // 6 G — pentagon bottom-right
      { x: 0.33, y: 0.66, mag: 2.6 }, // 7 E — pentagon bottom-left (node)
      { x: 0.2, y: 0.79, mag: 3.2 }, // 8 I — left leg
      { x: 0.07, y: 0.93, mag: 3.2 }, // 9 J — left foot
      { x: 0.58, y: 0.83, mag: 3.2 }, // 10 L — right leg fork
      { x: 0.74, y: 0.91, mag: 3.2 }, // 11 K — right foot
      { x: 0.46, y: 0.95, mag: 3.4 }, // 12 M — lower dangle
    ],
    lines: [
      [1, 0], // antenna — C to H
      [1, 2], // pentagon — top edge C-D
      [2, 5], // pentagon — right side upper D-F
      [5, 6], // pentagon — right side lower F-G (the knee)
      [6, 7], // pentagon — bottom edge G-E
      [7, 1], // pentagon — left edge E-C
      [2, 3], // arm — D up to the corner
      [3, 4],
      [7, 8], // left leg off the node E
      [8, 9],
      [6, 10], // lower-right leg off G
      [10, 11],
      [10, 12], // lower dangle
    ],
  },

  // Libra — a triangle of three bright stars (top-left, top-right,
  // bottom-right) with two trailing chains: a three-star tail hanging
  // down-left off the top-left star, and a two-star tail dropping off
  // the bottom-right star. The top-left star anchors as the hero; the
  // other two triangle stars stay bright but un-glowed.
  libra: {
    label: 'LIBRA',
    glyph: '♎',
    stars: [
      { x: 0.26, y: 0.2, mag: 1.5 }, // 0 A — top-left (anchor)
      { x: 0.66, y: 0.24, mag: 1.9 }, // 1 B — top-right
      { x: 0.74, y: 0.6, mag: 1.9 }, // 2 C — bottom-right
      { x: 0.28, y: 0.4, mag: 3.2 }, // 3 D — left tail
      { x: 0.22, y: 0.54, mag: 3.2 }, // 4 E — left tail
      { x: 0.15, y: 0.7, mag: 3.0 }, // 5 F — left tail end
      { x: 0.6, y: 0.78, mag: 3.2 }, // 6 G — lower tail
      { x: 0.68, y: 0.92, mag: 3.0 }, // 7 H — lower tail end
    ],
    lines: [
      [0, 1], // triangle — top edge
      [0, 2], // triangle — diagonal
      [1, 2], // triangle — right edge
      [0, 3], // left tail
      [3, 4],
      [4, 5],
      [2, 6], // lower tail
      [6, 7],
    ],
  },

  // Escorpio — long S-curve from head with claws at the upper-left
  // down through Antares to a curled stinger.
  escorpio: {
    label: 'ESCORPIO',
    glyph: '♏',
    stars: [
      { x: 0.1, y: 0.2, mag: 2.7 }, // 0 left claw
      { x: 0.22, y: 0.3, mag: 2.3 }, // 1 head
      { x: 0.4, y: 0.18, mag: 2.7 }, // 2 right claw
      { x: 0.36, y: 0.42, mag: 2.9 }, // 3 body high
      { x: 0.5, y: 0.55, mag: 1.5 }, // 4 Antares (anchor)
      { x: 0.55, y: 0.72, mag: 3.0 }, // 5 body mid
      { x: 0.7, y: 0.82, mag: 2.8 }, // 6 body bend
      { x: 0.84, y: 0.78, mag: 2.4 }, // 7 tail curl
      { x: 0.9, y: 0.62, mag: 2.6 }, // 8 tail
      { x: 0.8, y: 0.45, mag: 1.9 }, // 9 stinger tip
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

  // Sagitario — the full constellation. The left side is an OPEN
  // bracket (top edge, long left edge, bottom edge) with a small fork
  // — not a closed box. A bridge crosses to the teapot: an upper
  // chain to the topmost star, the body quadrilateral, a spout off
  // its left, a handle off its right, and legs forking down. Stars
  // sit at natural spacing; the centre scrim dims the few lines that
  // pass behind the counter. The bright right-hand star is the hero.
  sagitario: {
    label: 'SAGITARIO',
    glyph: '♐',
    stars: [
      // Left bracket + fork
      { x: 0.05, y: 0.28, mag: 2.4 }, // 0 bracket top-left
      { x: 0.24, y: 0.22, mag: 2.6 }, // 1 bracket top-right
      { x: 0.05, y: 0.72, mag: 2.4 }, // 2 bracket bottom-left
      { x: 0.23, y: 0.72, mag: 2.8 }, // 3 bracket bottom-mid
      { x: 0.3, y: 0.9, mag: 3.0 }, // 4 fork
      // Upper chain
      { x: 0.46, y: 0.07, mag: 2.8 }, // 5 topmost
      { x: 0.5, y: 0.22, mag: 2.8 }, // 6 upper-mid
      { x: 0.59, y: 0.26, mag: 3.0 }, // 7 hook
      // Teapot body
      { x: 0.46, y: 0.37, mag: 2.0 }, // 8 body top-left (junction)
      { x: 0.62, y: 0.41, mag: 2.4 }, // 9 body top-right
      { x: 0.44, y: 0.51, mag: 2.4 }, // 10 body bottom-left
      { x: 0.58, y: 0.53, mag: 2.2 }, // 11 body bottom-right
      { x: 0.35, y: 0.45, mag: 2.8 }, // 12 spout tip
      // Handle + bright star
      { x: 0.72, y: 0.43, mag: 2.6 }, // 13 handle junction
      { x: 0.85, y: 0.31, mag: 1.5 }, // 14 right bright star (anchor)
      { x: 0.81, y: 0.55, mag: 2.8 }, // 15 handle lower
      // Legs
      { x: 0.65, y: 0.65, mag: 2.4 }, // 16 leg junction
      { x: 0.61, y: 0.86, mag: 3.0 }, // 17 leg foot
      { x: 0.81, y: 0.74, mag: 3.0 }, // 18 leg right
    ],
    lines: [
      [1, 0], // bracket — top edge
      [0, 2], // bracket — left edge
      [2, 3], // bracket — bottom edge
      [3, 4], // fork
      [1, 8], // bridge to the teapot
      [5, 6], // upper chain
      [6, 7],
      [6, 8],
      [8, 9], // body
      [8, 10],
      [10, 11],
      [9, 11],
      [12, 8], // spout
      [12, 10],
      [9, 13], // handle
      [13, 14],
      [13, 15],
      [15, 11],
      [11, 16], // legs
      [16, 17],
      [16, 18],
    ],
  },

  // Capricornio — wide curved wedge (sea-goat profile) from upper-
  // left around to lower-right.
  // Capricornio — a broad triangle: a two-star apex up top, a left
  // edge and a right edge descending from it, and a chain of stars
  // closing the base. The counter sits inside the triangle interior,
  // clear of every star. The apex star anchors as the fuchsia hero.
  capricornio: {
    label: 'CAPRICORNIO',
    glyph: '♑',
    stars: [
      { x: 0.56, y: 0.08, mag: 2.4 }, // 0 apex top
      { x: 0.54, y: 0.17, mag: 1.5 }, // 1 apex (anchor)
      { x: 0.33, y: 0.5, mag: 3.0 }, // 2 left edge
      { x: 0.21, y: 0.63, mag: 2.8 }, // 3 lower-left
      { x: 0.11, y: 0.74, mag: 2.6 }, // 4 bottom-left
      { x: 0.2, y: 0.79, mag: 3.0 }, // 5 base
      { x: 0.35, y: 0.76, mag: 3.0 }, // 6 base
      { x: 0.5, y: 0.75, mag: 2.8 }, // 7 base
      { x: 0.63, y: 0.72, mag: 2.8 }, // 8 base
      { x: 0.75, y: 0.67, mag: 2.4 }, // 9 lower-right
      { x: 0.81, y: 0.58, mag: 2.0 }, // 10 right edge
    ],
    lines: [
      [0, 1], // apex pair
      [1, 2], // left edge
      [2, 3],
      [3, 4],
      [4, 5], // base chain
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10], // right edge
      [10, 1],
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
