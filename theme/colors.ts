/*
 * PALETA CERRADA (contrato C1 · 5 jul 2026, modelo Apple: eliges un ROL,
 * no un color). Ningún hex/rgba vive fuera de este archivo, con UNA
 * excepción: las escenas de ARTE (atmósferas, Cosmos, Skia, constelación)
 * donde el hex es pintura — su lista exenta vive en
 * docs/design-tokens-inventory.md y alimenta el lint C3. Un hex nuevo aquí
 * requiere justificación de rol, no de gusto.
 *
 * Mapeo de ROLES (la semántica que carga cada primitivo):
 *   leche    → texto primario            bone  → texto secundario
 *   niebla   → texto muted/captions      bruma → disabled/dim
 *   bg       → fondo de pantalla         bgCard/bgCard2 → superficies
 *   hairline / hairlineStrong → separadores y bordes
 *   magenta* → acción / acento / lo construido en Stelar
 *   oro*     → ceremonial / títulos de Órbita / navegación dorada
 *   dimension.* / signal.* → acentos semánticos por señal de producto
 *   feedback* → estados de error/éxito
 */
export const colors = {
  // ── Surfaces ───────────────────────────────────────────────────
  bg: '#0A0608',
  bgCard: '#14080B',
  bgCard2: '#1F0E13',

  // ── Foreground (cream tones on dark) ───────────────────────────
  leche: '#F4ECDE',
  bone: '#C9B8A5',
  niebla: '#8A7570',
  bruma: '#4F3A3D',

  // ── Magenta accent ─────────────────────────────────────────────
  magenta: '#E91E63',
  magentaHot: '#FF4886',
  magentaDeep: '#A6164A',
  magentaGlow: 'rgba(233, 30, 99, 0.45)',
  magentaTint: 'rgba(233, 30, 99, 0.10)',
  magentaTint2: 'rgba(233, 30, 99, 0.18)',

  // ── Hairlines (alpha over leche) ───────────────────────────────
  hairline: 'rgba(244, 236, 222, 0.10)',
  // Aún más tenue, para bordes de card/dividers dentro del cielo (reemplaza
  // los rgba(255,255,255,…) blanco-frío que violaban la paleta cerrada).
  hairlineFaint: 'rgba(244, 236, 222, 0.06)',
  hairlineStrong: 'rgba(244, 236, 222, 0.22)',
  // Barely-there leche surface for read-only cards/pills that need a hint of
  // body without becoming a panel (Órbita Día tablero, pills).
  lecheTint: 'rgba(244, 236, 222, 0.04)',

  oro: '#D9AE6F',
  oroSoft: '#E8B872',
  oroLight: '#FFE9C2',
  oroLeche: '#FFF6E5',
  oroHairline: 'rgba(217, 174, 111, 0.22)',
  oroTint: 'rgba(217, 174, 111, 0.08)',
  // Even fainter hairline for "astral chart" row dividers inside cards.
  oroHairlineSoft: 'rgba(217, 174, 111, 0.12)',
  // Halo de un "día encendido" (estrella de luz): glow medio + bloom exterior.
  // Pareja del oro para puntos de luz, como `magentaGlow` lo es del magenta.
  oroGlow: 'rgba(217, 174, 111, 0.22)',
  oroBloom: 'rgba(217, 174, 111, 0.10)',

  // ── Utilitarios con rol (E1 · 5 jul 2026) ──────────────────────
  /** Glifos sobre acento y núcleos de luz (leche es crema; esto es blanco puro). */
  blanco: '#FFFFFF',
  /** shadowColor de cards/sheets — el negro puro solo existe como sombra. */
  sombra: '#000000',
  /** La píldora de navegación (chrome del tab bar, un paso sobre bg). */
  bgNav: '#1A0810',
  /** Sobre-meta sereno: ámbar cálido, nunca rojo (SpeedometerRing y afines). */
  ambar: '#F1A65A',
  /** La luz rosa pálida de los núcleos/glow de estrella — recurría ×39 como
   *  literal entre escenas (cubeta b del inventario C0, promovida a token). */
  rosaLuz: '#FBD7E3',
  /** Tinte oro de la familia de iconos line-art cuando acompaña ilustraciones
   *  vect (su oro horneado es #EEDD91; el icono tintado debe hermanar). */
  oroVect: '#EEDD91',

  // ── Feedback ───────────────────────────────────────────────────
  feedbackSuccess: '#5A6F4C',
  feedbackError: '#B85045',
  // Muted-red chrome for the destructive delete-account button — reads as
  // a tappable surface without competing with the magenta voice.
  feedbackErrorHairline: 'rgba(184, 80, 69, 0.30)',
  feedbackErrorTint: 'rgba(184, 80, 69, 0.07)',

  // ── Scan beam — the AI scan-line light sweep ───────────────────
  beamTint: 'rgba(255, 72, 134, 0.32)',
  beamLine: 'rgba(255, 140, 180, 0.55)',

  // ── Scrim — a dark wash for chips sitting over a photo ─────────
  scrim: 'rgba(0, 0, 0, 0.55)',

  // ── Dimension identity ─────────────────────────────────────────
  // One colour per dimension. Drives focus halos, dimension badges,
  // and the "tu cuerpo / tu sueño / ..." accents. Palette stays in
  // the warm-dark + magenta brand: no neons, every value shares a
  // slightly desaturated tinted base.
  dimension: {
    cuerpo: '#FF4886', // magenta hot
    sueno: '#7C8FFF', // indigo
    alimento: '#9FE2A8', // sage
    ciclo: '#B5C4DD', // cool silver-blue
    energia: '#FFC56B', // warm gold
    mente: '#C18FFF', // violet
  },
  // Sub-señales que NO son dimensiones (proteína, agua) pero llevan acento en
  // los chips de Órbita. Antes vivían como hex sueltos en el componente y
  // chocaban con la paleta: proteína era casi idéntica al índigo de sueño, y
  // agua era el único cian frío-saturado. Reubicadas y diferenciadas.
  signal: {
    proteina: '#E0AEA0', // coral cálido — nutrición, distinto del índigo
    agua: '#8FBEDB', // azul cielo calmado — menos neón que el cian previo
    entreno: '#FF9E57', // naranja movimiento — antes copiado como hex en Semana/Mes
  },

  // (Los alias legacy Pearl Mauve se migraron y eliminaron el 5 jul 2026:
  // una paleta cerrada con puerta trasera deprecated no está cerrada.)
  /** @deprecated Use `hairline` */
  borderSubtle: 'rgba(244, 236, 222, 0.10)',
  /** @deprecated Use `bruma` */
  borderDashed: '#4F3A3D',
  /** @deprecated Use `bg` */
  inkDark: '#0A0608',
  /** @deprecated Use `bgCard` */
  inkDarkHighlight: '#14080B',
  /** @deprecated Use `bg` shadow tokens directly */
  shadowCard: 'rgba(0, 0, 0, 0.4)',
  /** @deprecated Use `bg` shadow tokens directly */
  shadowLift: 'rgba(0, 0, 0, 0.55)',
  /** @deprecated Use `bgCard` */
  cameraDark: '#14080B',
  /** @deprecated Use `bg` */
  cameraDarkBottom: '#0A0608',
} as const

export type ColorToken = keyof typeof colors
