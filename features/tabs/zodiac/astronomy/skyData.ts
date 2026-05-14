import type { ZodiacSign } from '../types'

import type { CelestialStar } from './project'

/**
 * Per-sign celestial data. Stars are hand-picked from HYG 3.0
 * (public domain) — Hipparcos positions (J2000) and apparent
 * magnitudes for the canonical bright stars of each constellation.
 *
 * Line pairs follow HA Rey's "see the constellations" stick figures,
 * the lineage most modern apps (Stellarium, Sky Guide) default to
 * because the silhouettes actually look like the figures.
 *
 * Coordinates are in decimal degrees. Convert HMS / DMS at the source
 * — runtime code expects degrees only.
 */

export type SkyConstellation = {
  label: string
  glyph: string
  stars: readonly CelestialStar[]
  lines: readonly (readonly [number, number])[]
}

export const SKY_DATA: Record<ZodiacSign, SkyConstellation> = {
  aries: {
    label: 'ARIES',
    glyph: '♈',
    stars: [
      { name: 'Mesarthim (γ)', ra: 28.38, dec: 19.294, mag: 3.86 },
      { name: 'Sheratan (β)', ra: 28.66, dec: 20.808, mag: 2.64 },
      { name: 'Hamal (α)', ra: 31.793, dec: 23.462, mag: 2.0 },
      { name: '41 Ari (Bharani)', ra: 42.496, dec: 27.261, mag: 3.61 },
      { name: 'Botein (δ)', ra: 47.907, dec: 19.727, mag: 4.35 },
      { name: '35 Ari', ra: 41.473, dec: 27.708, mag: 4.65 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 5],
      [2, 4],
    ],
  },

  tauro: {
    label: 'TAURO',
    glyph: '♉',
    stars: [
      { name: 'Alcyone (η)', ra: 56.871, dec: 24.105, mag: 2.87 },
      { name: 'Electra (17)', ra: 56.219, dec: 24.113, mag: 3.7 },
      { name: 'Merope (23)', ra: 56.58, dec: 23.948, mag: 4.18 },
      { name: 'Aldebaran (α)', ra: 68.98, dec: 16.509, mag: 0.86 },
      { name: 'Hyadum II (δ¹)', ra: 65.734, dec: 17.542, mag: 3.76 },
      { name: 'Hyadum I (γ)', ra: 64.948, dec: 15.628, mag: 3.65 },
      { name: 'Ain (ε)', ra: 67.154, dec: 19.181, mag: 3.53 },
      { name: 'θ² Tau', ra: 67.165, dec: 15.871, mag: 3.4 },
      { name: 'Elnath (β)', ra: 81.573, dec: 28.608, mag: 1.65 },
      { name: 'Tianguan (ζ)', ra: 84.411, dec: 21.143, mag: 3.0 },
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 2],
      [3, 4],
      [4, 6],
      [4, 5],
      [3, 7],
      [3, 8],
      [3, 9],
    ],
  },

  geminis: {
    label: 'GÉMINIS',
    glyph: '♊',
    stars: [
      { name: 'Castor (α)', ra: 113.65, dec: 31.888, mag: 1.58 },
      { name: 'Pollux (β)', ra: 116.329, dec: 28.026, mag: 1.14 },
      { name: 'Wasat (δ)', ra: 110.03, dec: 21.982, mag: 3.53 },
      { name: 'Mebsuta (ε)', ra: 100.983, dec: 25.131, mag: 3.06 },
      { name: 'Tejat (μ)', ra: 95.74, dec: 22.514, mag: 2.87 },
      { name: 'Propus (η)', ra: 93.72, dec: 22.506, mag: 3.31 },
      { name: 'Alhena (γ)', ra: 99.428, dec: 16.399, mag: 1.93 },
      { name: 'Mekbuda (ζ)', ra: 106.027, dec: 20.57, mag: 4.01 },
      { name: 'κ Gem', ra: 116.112, dec: 24.398, mag: 3.57 },
    ],
    lines: [
      [0, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [1, 8],
      [8, 7],
      [7, 6],
      [0, 1],
    ],
  },

  cancer: {
    label: 'CÁNCER',
    glyph: '♋',
    stars: [
      { name: 'Altarf (β)', ra: 124.128, dec: 9.186, mag: 3.53 },
      { name: 'Acubens (α)', ra: 134.622, dec: 11.858, mag: 4.26 },
      { name: 'Asellus Australis (δ)', ra: 131.171, dec: 18.155, mag: 3.94 },
      { name: 'Asellus Borealis (γ)', ra: 131.674, dec: 21.469, mag: 4.66 },
      { name: 'ι Cnc', ra: 131.674, dec: 28.762, mag: 4.02 },
    ],
    lines: [
      [0, 2],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },

  leo: {
    label: 'LEO',
    glyph: '♌',
    stars: [
      { name: 'Regulus (α)', ra: 152.093, dec: 11.967, mag: 1.35 },
      { name: 'η Leo', ra: 151.834, dec: 16.763, mag: 3.51 },
      { name: 'Algieba (γ)', ra: 154.993, dec: 19.842, mag: 2.61 },
      { name: 'Adhafera (ζ)', ra: 154.173, dec: 23.417, mag: 3.43 },
      { name: 'Rasalas (μ)', ra: 142.677, dec: 26.007, mag: 3.88 },
      { name: 'Algenubi (ε)', ra: 146.463, dec: 23.774, mag: 2.98 },
      { name: 'Zosma (δ)', ra: 168.527, dec: 20.524, mag: 2.56 },
      { name: 'Chertan (θ)', ra: 168.56, dec: 15.43, mag: 3.34 },
      { name: 'Denebola (β)', ra: 177.265, dec: 14.572, mag: 2.14 },
    ],
    lines: [
      [5, 4],
      [4, 3],
      [3, 2],
      [2, 1],
      [1, 0],
      [0, 7],
      [7, 6],
      [6, 8],
      [6, 2],
    ],
  },

  virgo: {
    label: 'VIRGO',
    glyph: '♍',
    stars: [
      { name: 'Spica (α)', ra: 201.298, dec: -11.161, mag: 0.98 },
      { name: 'Porrima (γ)', ra: 190.415, dec: -1.449, mag: 2.74 },
      { name: 'Vindemiatrix (ε)', ra: 195.544, dec: 10.959, mag: 2.83 },
      { name: 'Auva (δ)', ra: 193.901, dec: 3.398, mag: 3.39 },
      { name: 'Heze (ζ)', ra: 203.673, dec: -0.596, mag: 3.38 },
      { name: 'Zavijava (β)', ra: 177.674, dec: 1.765, mag: 3.59 },
      { name: 'Zaniah (η)', ra: 184.976, dec: -0.667, mag: 3.89 },
      { name: 'ι Vir', ra: 213.918, dec: -5.99, mag: 4.07 },
    ],
    lines: [
      [0, 4],
      [4, 3],
      [3, 2],
      [3, 1],
      [1, 5],
      [1, 6],
      [4, 7],
    ],
  },

  libra: {
    label: 'LIBRA',
    glyph: '♎',
    stars: [
      { name: 'Zubenelgenubi (α²)', ra: 222.72, dec: -16.042, mag: 2.75 },
      { name: 'Zubeneschamali (β)', ra: 229.252, dec: -9.383, mag: 2.61 },
      { name: 'Zubenelhakrabi (γ)', ra: 233.882, dec: -14.789, mag: 3.91 },
      { name: 'Brachium (σ)', ra: 224.633, dec: -25.282, mag: 3.29 },
      { name: 'υ Lib', ra: 235.586, dec: -28.135, mag: 3.58 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [0, 2],
      [0, 3],
      [3, 4],
      [4, 2],
    ],
  },

  escorpio: {
    label: 'ESCORPIO',
    glyph: '♏',
    stars: [
      { name: 'Acrab (β)', ra: 241.359, dec: -19.806, mag: 2.62 },
      { name: 'Dschubba (δ)', ra: 240.083, dec: -22.622, mag: 2.32 },
      { name: 'π Sco', ra: 239.713, dec: -26.114, mag: 2.89 },
      { name: 'Alniyat (σ)', ra: 245.297, dec: -25.593, mag: 2.89 },
      { name: 'Antares (α)', ra: 247.352, dec: -26.432, mag: 1.06 },
      { name: 'Paikauhale (τ)', ra: 248.971, dec: -28.216, mag: 2.82 },
      { name: 'Larawag (ε)', ra: 252.541, dec: -34.293, mag: 2.29 },
      { name: 'μ Sco', ra: 252.968, dec: -38.048, mag: 2.99 },
      { name: 'ζ Sco', ra: 253.499, dec: -42.362, mag: 4.73 },
      { name: 'η Sco', ra: 258.038, dec: -43.239, mag: 3.32 },
      { name: 'Sargas (θ)', ra: 264.33, dec: -42.998, mag: 1.86 },
      { name: 'ι Sco', ra: 266.901, dec: -40.127, mag: 2.99 },
      { name: 'Girtab (κ)', ra: 265.622, dec: -39.03, mag: 2.39 },
      { name: 'Shaula (λ)', ra: 263.402, dec: -37.104, mag: 1.62 },
      { name: 'Lesath (υ)', ra: 262.691, dec: -37.296, mag: 2.69 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [12, 13],
      [13, 14],
    ],
  },

  sagitario: {
    label: 'SAGITARIO',
    glyph: '♐',
    stars: [
      { name: 'Alnasl (γ²)', ra: 271.452, dec: -30.424, mag: 2.99 },
      { name: 'Kaus Media (δ)', ra: 275.249, dec: -29.828, mag: 2.72 },
      { name: 'Kaus Australis (ε)', ra: 276.043, dec: -34.385, mag: 1.85 },
      { name: 'Kaus Borealis (λ)', ra: 276.993, dec: -25.421, mag: 2.81 },
      { name: 'φ Sgr', ra: 281.414, dec: -26.991, mag: 3.17 },
      { name: 'Nunki (σ)', ra: 283.816, dec: -26.297, mag: 2.05 },
      { name: 'τ Sgr', ra: 286.738, dec: -27.671, mag: 3.32 },
      { name: 'Ascella (ζ)', ra: 285.653, dec: -29.881, mag: 2.59 },
      { name: 'Albaldah (π)', ra: 287.441, dec: -21.024, mag: 2.89 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 2],
      [4, 7],
      [3, 8],
    ],
  },

  capricornio: {
    label: 'CAPRICORNIO',
    glyph: '♑',
    stars: [
      { name: 'Algedi (α²)', ra: 304.514, dec: -12.508, mag: 3.57 },
      { name: 'Dabih (β)', ra: 305.253, dec: -14.781, mag: 3.05 },
      { name: 'ω Cap', ra: 312.956, dec: -26.919, mag: 4.11 },
      { name: 'ζ Cap', ra: 321.667, dec: -22.411, mag: 3.74 },
      { name: 'θ Cap', ra: 318.954, dec: -17.232, mag: 4.07 },
      { name: 'Nashira (γ)', ra: 325.023, dec: -16.662, mag: 3.69 },
      { name: 'Deneb Algedi (δ)', ra: 326.76, dec: -16.127, mag: 2.85 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 0],
    ],
  },

  acuario: {
    label: 'ACUARIO',
    glyph: '♒',
    stars: [
      { name: 'Sadalsuud (β)', ra: 322.89, dec: -5.571, mag: 2.91 },
      { name: 'Sadalmelik (α)', ra: 331.446, dec: -0.32, mag: 2.95 },
      { name: 'Sadachbia (γ)', ra: 337.876, dec: -1.387, mag: 3.84 },
      { name: 'ζ Aqr', ra: 337.211, dec: -0.02, mag: 3.65 },
      { name: 'η Aqr (Hydor)', ra: 343.155, dec: -0.117, mag: 4.04 },
      { name: 'π Aqr', ra: 335.412, dec: 1.376, mag: 4.66 },
      { name: 'λ Aqr', ra: 343.156, dec: -7.58, mag: 3.74 },
      { name: 'τ² Aqr', ra: 343.685, dec: -13.598, mag: 4.05 },
      { name: 'Skat (δ)', ra: 343.155, dec: -15.821, mag: 3.27 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 5],
      [2, 3],
      [3, 4],
      [3, 6],
      [6, 7],
      [7, 8],
    ],
  },

  piscis: {
    label: 'PISCIS',
    glyph: '♓',
    stars: [
      // Western fish (around the celestial meridian)
      { name: 'γ Psc', ra: 349.291, dec: 3.282, mag: 3.69 },
      { name: 'ι Psc', ra: 354.939, dec: 5.626, mag: 4.13 },
      { name: 'θ Psc', ra: 358.236, dec: 6.379, mag: 4.27 },
      { name: 'ω Psc', ra: 358.323, dec: 6.864, mag: 4.01 },
      // Cord knot + eastern fish
      { name: 'λ Psc', ra: 5.831, dec: 1.778, mag: 4.5 },
      { name: 'Alrescha (α)', ra: 30.512, dec: 2.764, mag: 3.82 },
      { name: 'Alpherg (η)', ra: 22.873, dec: 15.346, mag: 3.62 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
}
