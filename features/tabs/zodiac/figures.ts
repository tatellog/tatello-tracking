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
    // Aligned to the ram in aries-art.svg — 6-star Aries curve
    // (continuous chain) repositioned to trace the ram's outline:
    // snout (left) → lower jaw → Hamal on the horn peak → back
    // shoulder → hip → rear-leg / tail. Same 6 stars + 5 lines
    // as the canonical asterism, just better anatomical fit.
    stars: [
      { x: 0.18, y: 0.42, mag: 2.6 }, // 0 snout (ram facing left)
      { x: 0.32, y: 0.5, mag: 3.4 }, // 1 lower jaw
      { x: 0.45, y: 0.32, mag: 1.5 }, // 2 Hamal — horn peak (anchor) ★
      { x: 0.62, y: 0.45, mag: 2.9 }, // 3 shoulder / back ridge
      { x: 0.72, y: 0.62, mag: 3.0 }, // 4 hip
      { x: 0.82, y: 0.78, mag: 3.3 }, // 5 rear leg / tail
    ],
    lines: [
      [0, 1], // snout → jaw
      [1, 2], // rise to Hamal (horn peak)
      [2, 3], // back curve
      [3, 4], // shoulder to hip
      [4, 5], // hip to tail
    ],
  },

  // Taurus — the bull: two horns reaching up-left, the Hyades V of
  // the face cascading down the centre, Aldebaran blazing as the eye,
  // and the body trailing to the lower-right.
  tauro: {
    label: 'TAURO',
    glyph: '♉',
    // Clean Taurus shape — symmetric short HORNS rising from the
    // bull's face (aligned with the art), tight HYADES V on the
    // face, ALDEBARAN as the bright eye at the V's apex, and a
    // short BODY chain extending right toward the rose. Lines
    // don't cross; the figure reads as bull-head + body trail.
    // 10 stars + 10 lines = 20 elements.
    stars: [
      // Horns (short, symmetric, rising from the face)
      { x: 0.32, y: 0.16, mag: 3.0 }, // 0 left horn tip
      { x: 0.4, y: 0.34, mag: 3.5 }, // 1 left horn base
      { x: 0.58, y: 0.16, mag: 2.0 }, // 2 right horn tip — Elnath ★
      { x: 0.5, y: 0.34, mag: 3.5 }, // 3 right horn base
      // Hyades V (tight triangle on the bull's face)
      { x: 0.36, y: 0.46, mag: 4.0 }, // 4 V upper-left
      { x: 0.54, y: 0.46, mag: 4.0 }, // 5 V upper-right
      { x: 0.45, y: 0.58, mag: 4.0 }, // 6 V apex (bottom of V)
      // Aldebaran (eye) sits just below the V apex
      { x: 0.5, y: 0.7, mag: 1.5 }, // 7 Aldebaran ★★
      // Body chain (toward the rose decoration on the right)
      { x: 0.68, y: 0.8, mag: 3.2 }, // 8 body forward
      { x: 0.86, y: 0.86, mag: 3.5 }, // 9 body tip
    ],
    lines: [
      [0, 1], // left horn
      [2, 3], // right horn
      [1, 4], // left horn base into V upper-left
      [3, 5], // right horn base into V upper-right
      [4, 5], // V top edge
      [4, 6], // V left edge (down to apex)
      [5, 6], // V right edge (down to apex)
      [6, 7], // V apex to Aldebaran (the eye)
      [7, 8], // Aldebaran to body forward
      [8, 9], // body tip
    ],
  },

  // Géminis — Castor (α Gem) and Pollux (β Gem) as the twin heads
  // at the upper-left, with both bodies cascading down and the feet
  // extending to the right toward Orion. Pollux is the brightest
  // (mag 1.14, the constellation's alpha despite the historical
  // beta designation); Castor is second (mag 1.58). Names + relative
  // positions match a standard star chart so the reveal renders an
  // astronomically faithful Géminis rather than an iconographic
  // stick figure.
  geminis: {
    label: 'GÉMINIS',
    glyph: '♊',
    // Iconic Géminis "II" — two parallel chains for the two twins
    // facing each other in geminis-art.svg, connected by the heads
    // at the top (Castor ↔ Pollux) and the feet at the bottom
    // (Alzirr ↔ Alhena). 10 stars + 10 lines = 20 elements.
    stars: [
      // Heads (the bright pair — α and β Gem)
      { x: 0.32, y: 0.15, mag: 1.5 }, // 0 Castor (left twin) ★
      { x: 0.62, y: 0.15, mag: 1.5 }, // 1 Pollux (right twin) ★
      // Upper bodies (shoulders)
      { x: 0.32, y: 0.32, mag: 3.0 }, // 2 left twin shoulder
      { x: 0.62, y: 0.32, mag: 3.0 }, // 3 right twin shoulder
      // Mid bodies (waists)
      { x: 0.32, y: 0.5, mag: 3.0 }, // 4 left twin waist
      { x: 0.62, y: 0.5, mag: 3.0 }, // 5 right twin waist (Wasat)
      // Lower bodies (knees)
      { x: 0.34, y: 0.68, mag: 3.0 }, // 6 left twin knee
      { x: 0.6, y: 0.68, mag: 3.0 }, // 7 right twin knee
      // Feet
      { x: 0.34, y: 0.88, mag: 3.0 }, // 8 Alzirr (left foot)
      { x: 0.6, y: 0.88, mag: 1.5 }, // 9 Alhena (right foot, bright) ★
    ],
    lines: [
      // Twin bond — heads connected at top
      [0, 1],
      // Left twin chain (Castor → foot)
      [0, 2],
      [2, 4],
      [4, 6],
      [6, 8],
      // Right twin chain (Pollux → Alhena)
      [1, 3],
      [3, 5],
      [5, 7],
      [7, 9],
      // Feet connected at bottom
      [8, 9],
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
      // The Sickle — the lion's head & mane: positioned so each
      // star lands on a visible part of the leo-art portrait.
      { x: 0.18, y: 0.68, mag: 1.5, name: 'Regulus', role: 'el corazón del león' },
      { x: 0.24, y: 0.52, mag: 3.5, name: 'Eta', role: 'su cuello' },
      { x: 0.3, y: 0.38, mag: 2.3, name: 'Algieba', role: 'la curva de su melena' },
      { x: 0.3, y: 0.22, mag: 3.5, name: 'Adhafera', role: 'la trenza de su melena' },
      { x: 0.4, y: 0.14, mag: 3.9, name: 'Rasalas', role: 'la corona de su cabeza' },
      { x: 0.5, y: 0.22, mag: 3.0, name: 'Epsilon', role: 'su mirada' },
      // The hindquarters — compacted so the triangle stays inside
      // the visible lion area instead of stretching past the
      // ornate mane decorations.
      { x: 0.52, y: 0.55, mag: 3.3, name: 'Chort', role: 'el inicio de su rugido' },
      { x: 0.58, y: 0.4, mag: 2.6, name: 'Zosma', role: 'la fuerza de su andar' },
      { x: 0.72, y: 0.5, mag: 2.0, name: 'Denebola', role: 'el último resplandor' },
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
    // Pentagon + branches kept as the canonical Virgo topology
    // but compacted so the whole figure fits inside the visible
    // woman silhouette in virgo-art.svg — antenna over the hair,
    // pentagon on the torso, legs descending through the dress.
    stars: [
      { x: 0.28, y: 0.12, mag: 3.4 }, // 0 H — antenna tip (hair flourish)
      { x: 0.4, y: 0.22, mag: 1.5 }, // 1 C — pentagon top-left (anchor) ★
      { x: 0.55, y: 0.3, mag: 3.0 }, // 2 D — pentagon top-right (shoulder)
      { x: 0.65, y: 0.18, mag: 3.2 }, // 3 B — arm bend
      { x: 0.78, y: 0.1, mag: 3.4 }, // 4 A — arm tip (reaching up)
      { x: 0.6, y: 0.46, mag: 3.4 }, // 5 F — right hip / knee
      { x: 0.62, y: 0.68, mag: 1.9 }, // 6 G — pentagon bottom-right ★
      { x: 0.34, y: 0.58, mag: 2.6 }, // 7 E — pentagon bottom-left (node)
      { x: 0.28, y: 0.74, mag: 3.2 }, // 8 I — left leg
      { x: 0.2, y: 0.88, mag: 3.2 }, // 9 J — left foot
      { x: 0.54, y: 0.82, mag: 3.2 }, // 10 L — right leg fork
      { x: 0.64, y: 0.9, mag: 3.2 }, // 11 K — right foot
      { x: 0.44, y: 0.9, mag: 3.4 }, // 12 M — lower dangle
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
    // Aligned to the scale in libra-art.svg: the TRIANGLE forms
    // the balance beam (A–B horizontal at top) converging down to
    // C where the woman holds it; the two TAILS are the chains
    // descending to the pans on each side. 8 stars + 8 lines = 16.
    stars: [
      { x: 0.22, y: 0.3, mag: 1.5 }, // 0 A — left beam end (anchor) ★
      { x: 0.72, y: 0.3, mag: 1.9 }, // 1 B — right beam end
      { x: 0.5, y: 0.58, mag: 1.9 }, // 2 C — woman's hands (lower vertex)
      { x: 0.18, y: 0.48, mag: 3.2 }, // 3 D — left chain upper
      { x: 0.16, y: 0.66, mag: 3.2 }, // 4 E — left chain mid
      { x: 0.18, y: 0.84, mag: 3.0 }, // 5 F — left pan
      { x: 0.78, y: 0.66, mag: 3.2 }, // 6 G — right chain
      { x: 0.82, y: 0.84, mag: 3.0 }, // 7 H — right pan
    ],
    lines: [
      [0, 1], // beam — horizontal top
      [0, 2], // left diagonal down to hands
      [1, 2], // right diagonal down to hands
      [0, 3], // left chain
      [3, 4],
      [4, 5], // left pan
      [1, 6], // right chain (from B, not from C — chains hang from beam ends)
      [6, 7], // right pan
    ],
  },

  // Escorpio — long S-curve from head with claws at the upper-left
  // down through Antares to a curled stinger.
  escorpio: {
    label: 'ESCORPIO',
    glyph: '♏',
    // Realigned to the escorpio-art.svg silhouette: scorpion body
    // is vertical with the head + claws at the top, body running
    // down the centre, and the tail wrapping to the lower-right
    // with the stinger curling back up. Coordinates trace that
    // anatomy so each lit star lands on a recognisable body part.
    stars: [
      { x: 0.32, y: 0.22, mag: 2.7 }, // 0 left claw — upper-left horn tip
      { x: 0.5, y: 0.3, mag: 2.3 }, // 1 head — between the horns
      { x: 0.68, y: 0.22, mag: 2.7 }, // 2 right claw — upper-right horn tip
      { x: 0.5, y: 0.42, mag: 2.9 }, // 3 body high — upper torso
      { x: 0.5, y: 0.55, mag: 1.5 }, // 4 Antares — the heart, anchor
      { x: 0.52, y: 0.68, mag: 3.0 }, // 5 body mid — lower torso
      { x: 0.58, y: 0.78, mag: 2.8 }, // 6 body bend — where tail starts curving
      { x: 0.72, y: 0.84, mag: 2.4 }, // 7 tail curl — tail extending right
      { x: 0.82, y: 0.72, mag: 2.6 }, // 8 tail — curving back up
      { x: 0.78, y: 0.55, mag: 1.9 }, // 9 stinger tip — pointing up
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
    // Aligned to the archer in sagitario-art.svg: BOW arc on the
    // upper-right (matching the art's bow), ARROW horizontal
    // through the archer's drawing hand, BODY on her torso,
    // LEGS extending down. 14 stars + 14 lines = 28 — fits the
    // cycle exactly so every element lights by day 28.
    stars: [
      // Bow (right side — three stars arcing along the bow's curve)
      { x: 0.82, y: 0.38, mag: 2.8 }, // 0 bow upper tip
      { x: 0.95, y: 0.55, mag: 2.0 }, // 1 bow apex (rightmost) ★
      { x: 0.82, y: 0.72, mag: 2.8 }, // 2 bow lower tip
      // Arrow (horizontal — nocked on bow string, shaft going left
      // toward the archer's hand)
      { x: 0.86, y: 0.55, mag: 3.2 }, // 3 arrow nock (on bow string)
      { x: 0.68, y: 0.55, mag: 3.0 }, // 4 arrow shaft mid
      { x: 0.55, y: 0.52, mag: 2.6 }, // 5 arrow tip (front hand)
      // Archer body — torso compact rectangle on the figure
      { x: 0.44, y: 0.4, mag: 2.4 }, // 6 head / shoulder line ★
      { x: 0.5, y: 0.48, mag: 3.0 }, // 7 right shoulder
      { x: 0.36, y: 0.52, mag: 2.8 }, // 8 left shoulder / chest
      { x: 0.48, y: 0.62, mag: 2.6 }, // 9 right waist
      { x: 0.38, y: 0.66, mag: 2.8 }, // 10 left waist
      // Lower body — legs / dress flowing down
      { x: 0.42, y: 0.78, mag: 2.6 }, // 11 hip / upper leg
      { x: 0.4, y: 0.9, mag: 3.0 }, // 12 lower leg
      { x: 0.52, y: 0.95, mag: 2.8 }, // 13 foot
    ],
    lines: [
      // Bow curve
      [0, 1],
      [1, 2],
      // Arrow on bow string + shaft + tip
      [1, 3], // arrow nock joins bow
      [3, 4],
      [4, 5],
      // Arrow tip joins the archer's hand at the shoulder
      [5, 7],
      // Body — head down through shoulders to waist
      [6, 7],
      [6, 8],
      [7, 9],
      [8, 10],
      [9, 10],
      // Legs flow down
      [10, 11],
      [11, 12],
      [12, 13],
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
    // Aligned to the goat-mermaid in capricornio-art.svg. The
    // classic Capricornus wedge is rotated so its apex (the
    // brightest pair) lands on the goat's HEAD/horns (upper-left),
    // the upper edge follows the back, and the tail tip falls
    // where the fish tail curls (lower-right). 11 stars + 11
    // lines = 22 elements (fits the 28-day cycle).
    stars: [
      // Head: horn tip + alpha (the brightest star sits on the snout)
      { x: 0.3, y: 0.18, mag: 2.4 }, // 0 horn tip
      { x: 0.34, y: 0.26, mag: 1.5 }, // 1 head / alpha (anchor) ★
      // Back ridge (chain along the goat's spine going right)
      { x: 0.44, y: 0.32, mag: 3.0 }, // 2 neck
      { x: 0.55, y: 0.34, mag: 3.0 }, // 3 upper back
      { x: 0.66, y: 0.4, mag: 2.6 }, // 4 mid back
      { x: 0.76, y: 0.5, mag: 2.4 }, // 5 hip
      // Tail (curving down-right then curling back)
      { x: 0.84, y: 0.6, mag: 2.0 }, // 6 tail upper ★
      { x: 0.84, y: 0.74, mag: 2.8 }, // 7 tail mid
      { x: 0.72, y: 0.82, mag: 3.0 }, // 8 tail curl
      // Belly chain (returning right-to-left under the body)
      { x: 0.54, y: 0.78, mag: 2.8 }, // 9 belly
      { x: 0.4, y: 0.72, mag: 2.6 }, // 10 belly front (closes back to head)
    ],
    lines: [
      [0, 1], // horn to head (apex pair)
      [1, 2], // head to neck
      [2, 3], // neck to back
      [3, 4], // back ridge
      [4, 5], // back to hip
      [5, 6], // hip to tail
      [6, 7], // tail curve
      [7, 8], // tail curl
      [8, 9], // tail back to belly
      [9, 10], // belly chain
      [10, 1], // close figure (belly to head)
    ],
  },

  // Acuario — exact figure from the user-provided SVG. Do not retune.
  acuario: {
    label: 'ACUARIO',
    glyph: '♒',
    // Exact 1:1 with the reference photograph of the real
    // Aquarius asterism — top star descending to the Y-junction
    // water jar, two right extensions, a left-going chain, a
    // central zigzag knot, and the bottom-right V. 13 stars + 12
    // lines = 25 elements (fits comfortably in the 28-day cycle).
    stars: [
      { x: 0.78, y: 0.13, mag: 2.5 }, // 0 top-right (descent start)
      { x: 0.62, y: 0.32, mag: 2.8 }, // 1 bend
      { x: 0.36, y: 0.42, mag: 2.0 }, // 2 Y-junction ★
      // Right arm chain (Y → mid → far)
      { x: 0.55, y: 0.5, mag: 3.0 }, // 3 right of Y
      { x: 0.72, y: 0.55, mag: 2.8 }, // 4 far right
      // Left chain (Y → below → far-left)
      { x: 0.32, y: 0.52, mag: 3.0 }, // 5 below Y
      { x: 0.21, y: 0.62, mag: 2.8 }, // 6 far-left
      // Central knot + zigzag
      { x: 0.32, y: 0.7, mag: 2.6 }, // 7 knot
      { x: 0.45, y: 0.78, mag: 2.8 }, // 8 zigzag down
      { x: 0.55, y: 0.7, mag: 3.0 }, // 9 zigzag up
      { x: 0.7, y: 0.78, mag: 2.8 }, // 10 zigzag right peak
      // Bottom V (water landing point)
      { x: 0.48, y: 0.92, mag: 2.6 }, // 11 bottom V left
      { x: 0.78, y: 0.92, mag: 2.6 }, // 12 bottom V right
    ],
    lines: [
      // Top descent into Y-junction
      [0, 1],
      [1, 2],
      // Right arm chain
      [2, 3],
      [3, 4],
      // Left chain
      [2, 5],
      [5, 6],
      // Down into the knot + zigzag
      [5, 7],
      [7, 8],
      [8, 9],
      [9, 10],
      // Bottom V
      [8, 11],
      [10, 12],
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
