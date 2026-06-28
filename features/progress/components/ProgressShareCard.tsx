import { useEffect, useRef, type ReactNode } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import { ZodiacArt } from '@/features/tabs/components/constellation/ZodiacArt'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

import StelarIcon from '@/assets/stelar-icon.png'
import { StelarLogo } from '@/components/brand/StelarLogo'
import { DEFAULT_SHARE_STYLE, type ShareCardStyle } from '../share-styles'

// Fixed 9:16 — rendered at this exact size so the capture is
// consistent and fits the share-sheet stage on any phone.
export const CARD_W = 320
export const CARD_H = Math.round((CARD_W * 16) / 9)

export type VisualShareVariant = 'retrato' | 'transformacion' | 'cambio'

// A seeded starfield with three brightness tiers — the celestial bed.
const CARD_STARS: { x: number; y: number; r: number; o: number }[] = (() => {
  const arr = []
  let s = 99173
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < 56; i += 1) {
    const b = rand()
    const bright = b > 0.9
    const mid = !bright && b > 0.62
    arr.push({
      x: rand() * CARD_W,
      y: rand() * CARD_H,
      r: bright ? 1.5 + rand() * 0.8 : mid ? 1 + rand() * 0.6 : 0.5 + rand() * 0.6,
      o: bright ? 0.36 + rand() * 0.16 : mid ? 0.2 + rand() * 0.13 : 0.06 + rand() * 0.12,
    })
  }
  return arr
})()

// Capa de grano para dithering — muchos puntos diminutos de opacidad muy baja
// repartidos por toda la tarjeta. Rompen los escalones de 8-bit del degradado
// (la causa de la "línea") sin leerse como estrellas.
const CARD_GRAIN: { x: number; y: number; r: number; o: number }[] = (() => {
  const arr: { x: number; y: number; r: number; o: number }[] = []
  let s = 24681
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < 520; i += 1) {
    arr.push({
      x: rand() * CARD_W,
      y: rand() * CARD_H,
      r: 0.4 + rand() * 0.55,
      o: 0.014 + rand() * 0.045,
    })
  }
  return arr
})()

type Props = {
  variant: VisualShareVariant
  beforeUrl: string
  afterUrl: string
  beforeDate: string
  afterDate: string
  /** Peso inicial / actual — null oculta la fila (sin datos falsos). */
  weightFrom: number | null
  weightTo: number | null
  /** Delta con signo, p. ej. "−0.3". */
  deltaText: string | null
  /** Entrenos del ciclo → "0 → N". */
  workoutsCount: number
  /** Constelación → "0% → N%". */
  revealedPct: number
  /** Signo + días encendidos — para la constelación firma / héroe. */
  sign: ZodiacSign
  litCount: number
  /** "ESCORPIO" — para "0% → 62% Escorpio". */
  signLabel: string
  coachCopy: string | null
  /** Fondo elegido en la fila "ESTILO". */
  cardStyle?: ShareCardStyle
  /** Fires once both photos have settled — gates the capture. */
  onReady: () => void
}

function PhotoFrame({
  url,
  now,
  accent,
  onSettled,
}: {
  url: string
  now: boolean
  accent: string
  onSettled: () => void
}) {
  return (
    // La foto "Ahora" se ilumina como una estrella encendida: un aura
    // suave del acento detrás del marco. "Antes" descansa, sin halo.
    <View style={now ? styles.nowHalo : undefined}>
      <View style={[styles.frame, now && { borderColor: accent }]}>
        <Image
          source={{ uri: url }}
          style={styles.img}
          resizeMode="cover"
          onLoad={onSettled}
          onError={onSettled}
        />
        <View style={[styles.chip, now ? { backgroundColor: accent } : styles.chipBefore]}>
          <Text style={[styles.chipText, now ? styles.chipTextNow : styles.chipTextBefore]}>
            {now ? 'Ahora' : 'Antes'}
          </Text>
        </View>
      </View>
    </View>
  )
}

// Title-case del label en mayúsculas: "ESCORPIO" → "Escorpio".
function titleCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase()
}

/* La firma de pie — la voz del coach y, opcionalmente, el emblema del
 * signo (arte zodiac-art con su halo dorado) como sello de marca. Llena
 * el tercio inferior con cielo en vez de aire muerto. */
function CardFooter({
  coachCopy,
  sign,
  showEmblem,
}: {
  coachCopy: string | null
  sign: ZodiacSign
  showEmblem: boolean
}) {
  return (
    <View style={styles.footer}>
      {coachCopy ? <Text style={styles.coach}>{coachCopy}</Text> : null}
      {showEmblem ? (
        <View style={styles.footerEmblem}>
          <ZodiacArt sign={sign} size={108} halo="soft" />
        </View>
      ) : null}
    </View>
  )
}

/*
 * La tarjeta compartible del cambio visual — una imagen 9:16 para Stories.
 * Tres franjas verticales (marca arriba · héroe al medio · firma abajo)
 * llenan el alto con intención. Tres formatos comparten la cama celeste:
 *   retrato        — las dos fotos, ANTES/AHORA y el cambio de peso.
 *   transformacion — el resumen: fotos + tres métricas (peso, entrenos,
 *                    constelación).
 *   cambio         — la constancia como héroe sobre la constelación.
 */
export function ProgressShareCard({
  variant,
  beforeUrl,
  afterUrl,
  beforeDate,
  afterDate,
  weightFrom,
  weightTo,
  deltaText,
  workoutsCount,
  revealedPct,
  sign,
  litCount,
  signLabel,
  coachCopy,
  cardStyle = DEFAULT_SHARE_STYLE,
  onReady,
}: Props) {
  const settled = useRef(0)
  const handleSettled = () => {
    settled.current += 1
    if (settled.current >= 2) onReady()
  }

  // Cambio no muestra fotos (el emblema es el héroe): nada async que
  // esperar, así que habilita la captura al montar.
  useEffect(() => {
    if (variant === 'cambio') onReady()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant])

  // El acento sigue el estilo: magenta por defecto, pero en Oro/Índigo
  // toma el glow del estilo para no chocar con el fondo cálido/frío.
  const accent =
    cardStyle.id === 'oro' || cardStyle.id === 'indigo' ? cardStyle.glow : colors.magenta

  const before = (
    <PhotoFrame url={beforeUrl} now={false} accent={accent} onSettled={handleSettled} />
  )
  const after = <PhotoFrame url={afterUrl} now accent={accent} onSettled={handleSettled} />

  const hasWeight = weightFrom != null && weightTo != null

  return (
    <View style={[styles.card, { backgroundColor: cardStyle.bg }]}>
      {/* Nebulosa como GLOW RADIAL (no degradado lineal): el radial difumina
          en curvas y evita el banding de 8-bit que dejaba líneas horizontales
          en los estilos de color. Misma técnica que la cama celeste del entreno. */}
      <Svg style={StyleSheet.absoluteFill} width={CARD_W} height={CARD_H}>
        <Defs>
          {/* Caída suave de 2 stops + radio amplio = sin filo de disco. */}
          <RadialGradient id="psc-nebula" cx="50%" cy="-6%" r="118%">
            <Stop
              offset="0"
              stopColor={cardStyle.nebulaColor}
              stopOpacity={cardStyle.nebulaAlpha}
            />
            <Stop offset="1" stopColor={cardStyle.nebulaColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={CARD_W} height={CARD_H} fill="url(#psc-nebula)" />
        {/* Grano sutil: dithering que rompe cualquier escalón de 8-bit del
            degradado para que no se lea como una línea. */}
        {CARD_GRAIN.map((g, i) => (
          <Circle key={`g-${i}`} cx={g.x} cy={g.y} r={g.r} fill={colors.leche} opacity={g.o} />
        ))}
        {CARD_STARS.map((st, i) => (
          <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill={colors.leche} opacity={st.o} />
        ))}
      </Svg>

      <View style={styles.brand}>
        <Image source={StelarIcon} style={styles.brandIcon} resizeMode="contain" />
        {/* Wordmark como brand asset (PNG), no como fuente. Más grande + blanco
            puro para que resalte junto al S9. */}
        <StelarLogo variant="wordmark" size={20} color="#FFFFFF" />
      </View>

      {variant === 'retrato' ? (
        <>
          <View style={styles.hero}>
            <View style={styles.diptychWide}>
              <View style={styles.col}>
                {before}
                <Text style={styles.date}>{beforeDate}</Text>
              </View>
              <View style={styles.col}>
                {after}
                <Text style={styles.date}>{afterDate}</Text>
              </View>
            </View>
            {hasWeight ? (
              <View
                style={[styles.deltaTag, { borderColor: accent, backgroundColor: tint(accent) }]}
              >
                <Text style={[styles.deltaTagText, { color: accent }]}>
                  {weightFrom} → {weightTo} kg
                </Text>
              </View>
            ) : null}
          </View>
          <CardFooter coachCopy={coachCopy} sign={sign} showEmblem />
        </>
      ) : variant === 'transformacion' ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.transformTitle}>MI TRANSFORMACIÓN</Text>
            <View style={styles.diptych}>
              <View style={styles.col}>
                {before}
                <Text style={styles.date}>{beforeDate}</Text>
              </View>
              <View style={styles.col}>
                {after}
                <Text style={styles.date}>{afterDate}</Text>
              </View>
            </View>
            <View style={styles.metricBox}>
              {hasWeight ? (
                <>
                  <MetricColumn
                    icon={<PesoIcon />}
                    label="PESO"
                    before={`${weightFrom} kg`}
                    after={`${weightTo} kg`}
                    accent={accent}
                  />
                  <View style={styles.metricDivider} />
                </>
              ) : null}
              <MetricColumn
                icon={<EntrenosIcon />}
                label="ENTRENOS"
                before="0"
                after={`${workoutsCount}`}
                accent={accent}
              />
              <View style={styles.metricDivider} />
              <MetricColumn
                icon={<ConstelacionMetricIcon />}
                label="CONSTELACIÓN"
                before="0%"
                after={`${revealedPct}%`}
                sub={titleCase(signLabel)}
                accent={accent}
              />
            </View>
          </View>
          <CardFooter coachCopy={coachCopy} sign={sign} showEmblem={false} />
        </>
      ) : (
        <>
          {/* El emblema del signo es el héroe — grande y nítido. La
              constancia se sella debajo, sin fotos: una sola idea limpia. */}
          <View style={styles.cambioHero}>
            <View style={styles.cambioEmblemBox}>
              <ZodiacArt sign={sign} size={210} halo="soft" />
            </View>
            <View style={styles.cambioSeal}>
              <Text style={[styles.cambioSealStar, { color: accent }]}>✦</Text>
              <Text style={[styles.cambioSealNum, { color: accent }]}>{litCount}</Text>
              <Text style={styles.cambioSealDias}>días</Text>
            </View>
            <Text style={styles.cambioSealLabel}>DE CONSTANCIA</Text>
          </View>
          <View style={styles.cambioFooter}>
            {coachCopy ? <Text style={styles.coach}>{coachCopy}</Text> : null}
          </View>
        </>
      )}
    </View>
  )
}

// Un tinte translúcido del acento para el fondo del pill de retrato.
function tint(hex: string): string {
  return `${hex}22`
}

/* Iconos dorados de cada métrica — un trazo, delicados, a tono observatorio. */
function PesoIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M7 8 H17 L19 19 H5 Z" stroke={colors.oro} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M9.5 8 A2.5 2.5 0 0 1 14.5 8" stroke={colors.oro} strokeWidth={1.4} />
    </Svg>
  )
}

function EntrenosIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 12 H15" stroke={colors.oro} strokeWidth={1.4} strokeLinecap="round" />
      <Rect x={4} y={9} width={3} height={6} rx={1} stroke={colors.oro} strokeWidth={1.4} />
      <Rect x={17} y={9} width={3} height={6} rx={1} stroke={colors.oro} strokeWidth={1.4} />
    </Svg>
  )
}

function ConstelacionMetricIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 L13.4 10.6 L21 12 L13.4 13.4 L12 21 L10.6 13.4 L3 12 L10.6 10.6 Z"
        fill={colors.oro}
      />
    </Svg>
  )
}

function MetricColumn({
  icon,
  label,
  before,
  after,
  sub,
  accent,
}: {
  icon: ReactNode
  label: string
  before: string
  after: string
  sub?: string
  accent: string
}) {
  return (
    <View style={styles.metricCol}>
      {icon}
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricBefore}>{before}</Text>
      <Text style={[styles.metricArrow, { color: accent }]}>↓</Text>
      <Text style={[styles.metricAfter, { color: accent }]}>{after}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: colors.bg,
    paddingHorizontal: 22,
    paddingTop: 38,
    paddingBottom: 30,
    // Tres franjas: marca arriba · héroe al medio · firma abajo.
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // El S9 ya trae margen transparente propio; gap 0 (el margen del PNG ya
    // deja aire) para que el wordmark quede junto al ícono.
    gap: 0,
  },
  brandIcon: {
    width: 26,
    height: 26,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  // ── shared photo frame ─────────────────────────────────────────────
  nowHalo: {
    borderRadius: 18,
    shadowColor: colors.magenta,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  frame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  chip: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
  },
  chipBefore: {
    backgroundColor: 'rgba(8, 5, 7, 0.78)',
  },
  chipText: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chipTextBefore: {
    color: colors.leche,
  },
  chipTextNow: {
    color: colors.leche,
  },
  col: {
    flex: 1,
  },
  date: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.niebla,
  },
  // ── retrato ────────────────────────────────────────────────────────
  diptychWide: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: -6,
  },
  deltaTag: {
    marginTop: 18,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  deltaTagText: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.title,
    letterSpacing: -0.5,
  },
  // ── transformacion ─────────────────────────────────────────────────
  transformTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.title,
    letterSpacing: 2.4,
    color: colors.leche,
    textAlign: 'center',
    marginBottom: 16,
  },
  diptych: {
    flexDirection: 'row',
    gap: 12,
  },
  metricBox: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 16,
  },
  metricDivider: {
    width: 0.5,
    backgroundColor: colors.hairline,
    marginVertical: 4,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  metricLabel: {
    marginTop: 2,
    fontFamily: typography.uiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.niebla,
    textTransform: 'uppercase',
  },
  metricBefore: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  metricArrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    marginVertical: -2,
  },
  metricAfter: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.title,
  },
  metricSub: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.oro,
  },
  // ── cambio (emblema héroe + sello de constancia) ───────────────────
  cambioHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cambioEmblemBox: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    marginBottom: 8,
  },
  cambioSeal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  cambioSealStar: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.heading,
  },
  cambioSealNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 44,
    letterSpacing: -1,
  },
  cambioSealDias: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.segmentTitle,
    color: colors.bone,
  },
  cambioSealLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 2.6,
    color: colors.leche,
    textTransform: 'uppercase',
  },
  cambioFooter: {
    alignItems: 'center',
    gap: 16,
  },
  // ── firma de pie ───────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    gap: 14,
  },
  footerEmblem: {
    width: 108,
    height: 108,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  coach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
})
