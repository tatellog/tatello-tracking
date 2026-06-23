import { useEffect, useRef } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { GLYPH_BY_SIGN } from '@/features/tabs/zodiac/glyphs'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

import { ZodiacArt } from '@/features/tabs/components/constellation/ZodiacArt'

import StelarIcon from '@/assets/stelar.png'
import { StelarLogo } from '@/components/brand/StelarLogo'
import { DEFAULT_SHARE_STYLE, type ShareCardStyle } from '../share-styles'

// Same 9:16 frame as ProgressShareCard so the captured PNG lives in
// the same visual language across the share-sheet tabs.
export const TRAINING_CARD_W = 320
export const TRAINING_CARD_H = Math.round((TRAINING_CARD_W * 16) / 9)

export type TrainingShareVariant = 'constelacion' | 'momento' | 'progreso'

// Seeded starfield with three brightness tiers — the celestial bed
// behind every shareable STELAR card. The brightest tier (o > 0.36)
// gets a bloom halo.
const CARD_STARS: { x: number; y: number; r: number; o: number }[] = (() => {
  const arr: { x: number; y: number; r: number; o: number }[] = []
  let s = 77119
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < 56; i += 1) {
    const b = rand()
    const bright = b > 0.9
    const mid = !bright && b > 0.62
    arr.push({
      x: rand() * TRAINING_CARD_W,
      y: rand() * TRAINING_CARD_H,
      r: bright ? 1.5 + rand() * 0.8 : mid ? 1 + rand() * 0.6 : 0.5 + rand() * 0.6,
      o: bright ? 0.36 + rand() * 0.16 : mid ? 0.2 + rand() * 0.13 : 0.06 + rand() * 0.12,
    })
  }
  return arr
})()

const BLOOM_STARS = CARD_STARS.filter((st) => st.o > 0.36)

// Capa de grano para dithering — rompe los escalones de 8-bit de los glows
// (la "línea"/banding) sin leerse como estrellas. Mismo truco que en las
// tarjetas de cambio visual.
const CARD_GRAIN: { x: number; y: number; r: number; o: number }[] = (() => {
  const arr: { x: number; y: number; r: number; o: number }[] = []
  let s = 51217
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < 520; i += 1) {
    arr.push({
      x: rand() * TRAINING_CARD_W,
      y: rand() * TRAINING_CARD_H,
      r: 0.4 + rand() * 0.55,
      o: 0.014 + rand() * 0.045,
    })
  }
  return arr
})()

type Props = {
  variant: TrainingShareVariant
  /** Local file URI of the just-captured workout photo (Momento). */
  photoUri: string | null
  /** Abre el selector de foto desde el estado vacío de Momento. */
  onAddPhoto?: () => void
  /** Sign key — drives the celestial glyph (GLYPH_BY_SIGN). */
  sign: ZodiacSign
  /** "ESCORPIO" — el nombre del signo en mayúsculas. */
  signLabel: string
  /** Días encendidos en el ciclo (grid_28_days). */
  dayCount: number
  /** 0..100 — fracción de la constelación revelada. */
  revealedPct: number
  /** "Próxima estrella DÍA X" — null cuando la figura ya está completa. */
  nextStarDay: number | null
  /** "Junio 2026". */
  monthLabel: string
  /** Entrenos del mes civil. */
  workoutsThisMonth: number
  /** Días activos del ciclo (= dayCount). */
  activeDays: number
  /** Peso inicial / actual — null oculta la fila (sin datos falsos). */
  weightFrom: number | null
  weightTo: number | null
  /** Una línea corta en voz de coach (serif italic). */
  coachCopy: string
  /** Fondo elegido en la fila "ESTILO". */
  cardStyle?: ShareCardStyle
  /** Fires once the card has settled — gates the capture. */
  onReady: () => void
}

/* El marco de la foto del entreno, 4:5 para no recortar el cuerpo
 * (manifiesto). La foto va en `contain`; detrás, la misma foto difuminada
 * + scrim llena el letterbox para que no haya barras muertas. */
function PhotoFrame({
  uri,
  halo,
  accent,
  onSettled,
}: {
  uri: string
  halo?: boolean
  accent?: string
  onSettled: () => void
}) {
  return (
    <View
      style={[
        styles.frame,
        halo && styles.frameHalo,
        halo && accent ? { shadowColor: accent } : null,
      ]}
    >
      <Image source={{ uri }} style={styles.imgBackdrop} resizeMode="cover" blurRadius={18} />
      <View style={styles.imgScrim} />
      <Image
        source={{ uri }}
        style={styles.img}
        resizeMode="contain"
        onLoad={onSettled}
        onError={onSettled}
      />
      <View style={styles.chip}>
        <Text style={styles.chipText}>HOY</Text>
      </View>
    </View>
  )
}

function SignGlyph({ sign, size }: { sign: ZodiacSign; size: number }) {
  const Glyph = GLYPH_BY_SIGN[sign]
  return <Glyph width={size} height={size} color={colors.oro} />
}

/* La cama celeste compartida — dos glows radiales suaves (2 stops, sin filo
 * de disco) + grano + el campo de estrellas. El glow superior toma el color
 * del estilo; el inferior es un oro tenue. Misma técnica anti-banding que
 * las tarjetas de cambio visual. */
function CelestialBed({ cardStyle }: { cardStyle: ShareCardStyle }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={TRAINING_CARD_W} height={TRAINING_CARD_H}>
      <Defs>
        <RadialGradient id="tsc-glow" cx="72%" cy="8%" r="100%">
          <Stop offset="0" stopColor={cardStyle.nebulaColor} stopOpacity={cardStyle.nebulaAlpha} />
          <Stop offset="1" stopColor={cardStyle.nebulaColor} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="tsc-oro" cx="16%" cy="32%" r="85%">
          <Stop offset="0" stopColor={colors.oro} stopOpacity={0.05} />
          <Stop offset="1" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={TRAINING_CARD_W} height={TRAINING_CARD_H} fill="url(#tsc-glow)" />
      <Rect width={TRAINING_CARD_W} height={TRAINING_CARD_H} fill="url(#tsc-oro)" />
      {CARD_GRAIN.map((g, i) => (
        <Circle key={`g-${i}`} cx={g.x} cy={g.y} r={g.r} fill={colors.leche} opacity={g.o} />
      ))}
      {BLOOM_STARS.map((st, i) => (
        <Circle
          key={`bloom-${i}`}
          cx={st.x}
          cy={st.y}
          r={st.r * 2.6}
          fill={colors.leche}
          opacity={st.o * 0.18}
        />
      ))}
      {CARD_STARS.map((st, i) => (
        <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill={colors.leche} opacity={st.o} />
      ))}
    </Svg>
  )
}

function Brand() {
  return (
    <View style={styles.brand}>
      <Image source={StelarIcon} style={styles.brandIcon} resizeMode="contain" />
      {/* Wordmark como brand asset (PNG), no como fuente. Más grande + blanco
          puro para que resalte junto al S9. */}
      <StelarLogo variant="wordmark" size={18} color="#FFFFFF" />
    </View>
  )
}

/*
 * La tarjeta compartible del entreno — una imagen 9:16 para Stories. Tres
 * formatos comparten la cama celeste + la marca, pero reordenan las piezas:
 *
 *   constelacion — la constelación parcialmente revelada es la heroína:
 *                  signo, % revelado y próxima estrella.
 *   momento      — la foto del entreno es la heroína; signo, día y % al pie.
 *   progreso     — las cifras del mes: días de movimiento, entrenos, peso.
 */
export function TrainingShareCard({
  variant,
  photoUri,
  onAddPhoto,
  sign,
  signLabel,
  dayCount,
  revealedPct,
  nextStarDay,
  monthLabel,
  workoutsThisMonth,
  activeDays,
  weightFrom,
  weightTo,
  coachCopy,
  cardStyle = DEFAULT_SHARE_STYLE,
  onReady,
}: Props) {
  const settled = useRef(false)
  const handleSettled = () => {
    if (settled.current) return
    settled.current = true
    onReady()
  }

  // Las tarjetas sin contenido asíncrono (constelacion, progreso, y momento
  // sin foto) asientan al montar; momento con foto asienta en onLoad.
  const hasPhoto = !!photoUri
  useEffect(() => {
    if (variant !== 'momento' || !hasPhoto) handleSettled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, hasPhoto])

  const hasConstellation = dayCount > 0

  // El acento sigue el estilo: magenta por defecto, glow del estilo en
  // Oro/Índigo para no chocar con el fondo.
  const accent =
    cardStyle.id === 'oro' || cardStyle.id === 'indigo' ? cardStyle.glow : colors.magenta

  return (
    <View style={[styles.card, { backgroundColor: cardStyle.bg }]}>
      <CelestialBed cardStyle={cardStyle} />
      <Brand />

      {variant === 'constelacion' ? (
        <View style={styles.middle}>
          <Text style={styles.signTitle}>{signLabel}</Text>
          {hasConstellation ? (
            <Text style={[styles.revealLine, { color: accent }]}>{revealedPct}% REVELADO</Text>
          ) : null}

          <View style={styles.constellationWrap}>
            <View style={styles.emblemBox}>
              <ZodiacArt sign={sign} size={184} halo="soft" />
            </View>
          </View>
          {!hasConstellation ? (
            <Text style={styles.emptyConstellation}>
              Tu constelación empieza con tu próximo entrenamiento.
            </Text>
          ) : null}

          {hasConstellation && nextStarDay != null ? (
            <View style={styles.nextStar}>
              <Text style={styles.eyebrowGold}>Próxima estrella</Text>
              <Text style={styles.nextStarDay}>DÍA {nextStarDay}</Text>
            </View>
          ) : null}

          <Text style={styles.coach}>{coachCopy}</Text>
        </View>
      ) : variant === 'momento' ? (
        <View style={styles.middle}>
          {hasPhoto ? (
            <>
              <View style={styles.momentoPhoto}>
                <PhotoFrame uri={photoUri!} halo accent={accent} onSettled={handleSettled} />
              </View>
              <View style={styles.meta}>
                <SignGlyph sign={sign} size={28} />
                <Text style={styles.eyebrowGold}>DÍA {dayCount}</Text>
                <Text style={styles.signMd}>{signLabel}</Text>
                {revealedPct > 0 ? (
                  <Text style={[styles.revealSmall, { color: accent }]}>
                    {revealedPct}% REVELADO
                  </Text>
                ) : null}
              </View>
              <Text style={styles.coach}>{coachCopy}</Text>
            </>
          ) : (
            <TouchableOpacity
              style={styles.photoEmpty}
              activeOpacity={0.8}
              onPress={onAddPhoto}
              accessibilityRole="button"
              accessibilityLabel="Agregar una foto"
            >
              <Text style={styles.photoEmptyStar}>✦</Text>
              <Text style={styles.photoEmptyText}>Agrega una foto para compartir tu momento.</Text>
              {onAddPhoto ? <Text style={styles.photoEmptyCta}>Agregar foto</Text> : null}
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.middle}>
          <View style={styles.progressHero}>
            <Text style={[styles.heroNum, { color: accent }]}>{activeDays}</Text>
            <Text style={styles.heroLabel}>DÍAS DE MOVIMIENTO</Text>
          </View>

          <Text style={styles.monthLine}>{monthLabel}</Text>

          <View style={styles.statList}>
            <StatRow label="Entrenos este mes" value={`${workoutsThisMonth}`} />
            <StatRow label="Días activos" value={`+${activeDays}`} />
            {weightFrom != null && weightTo != null ? (
              <StatRow label="Peso" value={`${weightFrom} → ${weightTo} kg`} />
            ) : null}
          </View>

          <Text style={styles.coach}>{coachCopy}</Text>
        </View>
      )}
    </View>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: TRAINING_CARD_W,
    height: TRAINING_CARD_H,
    backgroundColor: colors.bg,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 26,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
    justifyContent: 'center',
    // El S9 ya trae margen transparente propio; gap 0 para que el wordmark
    // quede junto al ícono.
    gap: 0,
  },
  brandIcon: {
    width: 24,
    height: 24,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── constelacion ───────────────────────────────────────────────────
  signTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.segmentTitle,
    letterSpacing: 4,
    color: colors.leche,
    textAlign: 'center',
  },
  revealLine: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 2.2,
    color: colors.magenta,
  },
  constellationWrap: {
    marginVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemBox: {
    width: 184,
    height: 184,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  emptyConstellation: {
    marginVertical: 40,
    paddingHorizontal: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.niebla,
    textAlign: 'center',
  },
  nextStar: {
    alignItems: 'center',
    gap: 3,
  },
  nextStarDay: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.title,
    letterSpacing: 2,
    color: colors.leche,
  },
  // ── momento ────────────────────────────────────────────────────────
  momentoPhoto: {
    width: '80%',
    alignSelf: 'center',
  },
  meta: {
    alignItems: 'center',
    gap: 6,
    marginTop: 22,
  },
  signMd: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.deltaNum,
    letterSpacing: 4,
    color: colors.leche,
    textAlign: 'center',
  },
  revealSmall: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    color: colors.magenta,
  },
  photoEmpty: {
    width: '86%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderStyle: 'dashed',
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  photoEmptyStar: {
    fontSize: 26,
    color: colors.magenta,
  },
  photoEmptyText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
    textAlign: 'center',
  },
  photoEmptyCta: {
    marginTop: 4,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
    color: colors.magenta,
  },
  // ── progreso ───────────────────────────────────────────────────────
  progressHero: {
    alignItems: 'center',
  },
  heroNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 96,
    paddingTop: 10,
    paddingBottom: 4,
    color: colors.magenta,
    textAlign: 'center',
  },
  heroLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 2.4,
    color: colors.leche,
  },
  monthLine: {
    marginTop: 18,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    letterSpacing: 1,
    color: colors.niebla,
    textTransform: 'uppercase',
  },
  statList: {
    marginTop: 18,
    width: '100%',
    paddingHorizontal: 8,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairline,
    paddingBottom: 10,
  },
  statLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  statValue: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  // ── frame compartido ───────────────────────────────────────────────
  frame: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  frameHalo: {
    shadowColor: colors.magenta,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    transform: [{ scale: 1.04 }],
  },
  imgBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  chip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.scrim,
    borderWidth: 0.5,
    borderColor: colors.oroHairline,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  chipText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    color: colors.oroLight,
  },
  // ── eyebrow dorado + coach ─────────────────────────────────────────
  eyebrowGold: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.2,
    color: colors.oro,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  coach: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
  },
})
