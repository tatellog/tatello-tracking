import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import { DEFAULT_SHARE_STYLE, type ShareCardStyle } from '../share-styles'
import { AuroraBed, ShareSignature, ShareTopRow, shortMonthYear } from './share-aurora'

// Fixed 9:16 — rendered at this exact size so the capture is
// consistent and fits the share-sheet stage on any phone.
export const CARD_W = 320
export const CARD_H = Math.round((CARD_W * 16) / 9)

export type VisualShareVariant = 'retrato' | 'transformacion' | 'cambio'

/*
 * Las tarjetas de "Tu cambio visual" para historias (rediseño dueña 5 oct
 * 2026). El héroe es el TIEMPO del proceso ("22 meses de constancia"), no la
 * báscula: lo que se admira de un antes y después es haberlo sostenido.
 *   transformacion — las dos fotos a sangre (ANTES / AHORA) y el tiempo.
 *   retrato        — la foto de ahora a pantalla completa y el antes como
 *                    polaroid inclinada.
 *   cambio         — "Tu camino", sin fotos: entrenos por mes en barras.
 * El peso solo aparece si la usuaria prende "Incluir peso" en la hoja, y en
 * neutro ("67.4 → 75 kg"), sin juicio ni ritmo.
 */

type Props = {
  variant: VisualShareVariant
  beforeUrl: string
  afterUrl: string
  /** 'YYYY-MM-DD' de cada foto (el tiempo del proceso sale de aquí). */
  beforeIso: string
  afterIso: string
  /** "15 ago 2024" — la fecha legible sobre cada foto. */
  beforeDate: string
  afterDate: string
  /** "22" + "meses" — el tiempo del proceso, ya formateado. */
  duration: { value: string; unit: string }
  /** Entrenos (a mano o del reloj) entre las dos fotos; null = sin dato. */
  workoutsTotal: number | null
  /** Entrenos por mes entre las fotos (Tu camino). */
  monthly: readonly { month: string; count: number }[]
  /** Peso inicial / actual — null oculta el chip (sin datos falsos). */
  weightFrom: number | null
  weightTo: number | null
  /** "Incluir peso" de la hoja (apagado por defecto). */
  includeWeight: boolean
  cardStyle?: ShareCardStyle
  /** Fires once the photos have settled — gates the capture. */
  onReady: () => void
}

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

export function ProgressShareCard({
  variant,
  beforeUrl,
  afterUrl,
  beforeIso,
  afterIso,
  beforeDate,
  afterDate,
  duration,
  workoutsTotal,
  monthly,
  weightFrom,
  weightTo,
  includeWeight,
  cardStyle = DEFAULT_SHARE_STYLE,
  onReady,
}: Props) {
  const settled = useRef(0)
  const done = useRef(false)
  const handleSettled = () => {
    settled.current += 1
    if (settled.current >= 2 && !done.current) {
      done.current = true
      onReady()
    }
  }
  // Tu camino no lleva fotos: nada async que esperar.
  useEffect(() => {
    if (variant === 'cambio' && !done.current) {
      done.current = true
      onReady()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant])

  const [accent, , gold] = cardStyle.aurora
  const weight =
    includeWeight && weightFrom != null && weightTo != null
      ? `${weightFrom} → ${weightTo} kg`
      : null
  // Mismo lenguaje que la Constelación (dueña 5 oct 2026): kicker en serif
  // dorada + título gigante, stickers DERECHOS y la firma con el dato.
  const title = `${duration.value} ${duration.unit.toUpperCase()}`
  const workoutsLabel =
    workoutsTotal != null && workoutsTotal > 0
      ? `${workoutsTotal} ${workoutsTotal === 1 ? 'ENTRENO' : 'ENTRENOS'}`
      : null

  if (variant === 'transformacion') {
    return (
      <View style={styles.card}>
        <AuroraBed width={CARD_W} height={CARD_H} cardStyle={cardStyle} />
        <View style={styles.split}>
          <Photo url={beforeUrl} onSettled={handleSettled} />
          <Photo url={afterUrl} onSettled={handleSettled} ring={accent} />
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
            style={styles.topShade}
            pointerEvents="none"
          />
          <View style={styles.overlayTop}>
            <ShareTopRow right={shortMonthYear(afterIso)} accent={accent} />
          </View>
          <Text style={[styles.tag, styles.tagBefore, { left: 10 }]}>ANTES</Text>
          <Text
            style={[
              styles.tag,
              { left: CARD_W / 2 + 10, backgroundColor: accent, color: cardStyle.onAccent },
            ]}
          >
            AHORA
          </Text>
          <Text style={[styles.photoDate, { left: 12 }]}>{beforeDate}</Text>
          <Text style={[styles.photoDate, { left: CARD_W / 2 + 12 }]}>{afterDate}</Text>
        </View>
        {weight ? (
          <Sticker light style={{ top: SPLIT_H - 18, alignSelf: 'center' }}>
            {weight}
          </Sticker>
        ) : null}
        <View style={styles.titleBlock}>
          <Text style={[styles.titleKicker, { color: gold }]}>mi transformación</Text>
          <Text style={styles.titleBig} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
        </View>
        <View style={styles.footer}>
          <ShareSignature label={workoutsLabel ?? 'STELAR'} />
        </View>
      </View>
    )
  }

  if (variant === 'retrato') {
    return (
      <View style={styles.card}>
        <Image
          source={{ uri: afterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={handleSettled}
          onError={handleSettled}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', cardStyle.bg]}
          locations={[0, 0.2, 0.45, 0.86]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.retratoTop}>
          <ShareTopRow right={shortMonthYear(afterIso)} accent={accent} />
        </View>
        <View style={styles.polaroid}>
          <Image
            source={{ uri: beforeUrl }}
            style={styles.polaroidImg}
            resizeMode="cover"
            onLoad={handleSettled}
            onError={handleSettled}
          />
          <Text style={styles.polaroidCaption}>{shortDate(beforeIso)}</Text>
        </View>
        {weight ? (
          <Sticker light style={{ top: 96, left: 14 }}>
            {weight}
          </Sticker>
        ) : null}
        <View style={styles.retratoText}>
          <Text style={[styles.titleKicker, styles.left, { color: gold }]}>mi proceso</Text>
          <Text style={[styles.titleBig, styles.left]} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
        </View>
        <View style={[styles.footer, styles.footerAbs]}>
          <ShareSignature label={workoutsLabel ?? 'STELAR'} />
        </View>
      </View>
    )
  }

  // Tu camino (sin fotos). La gráfica empieza en el primer mes con entreno:
  // meses vacíos antes de que existiera el dato no son historia.
  const firstActive = monthly.findIndex((m) => m.count > 0)
  const bars = firstActive > 0 ? monthly.slice(firstActive) : monthly
  const max = Math.max(1, ...bars.map((m) => m.count))
  const best = monthly.reduce((a, m) => (m.count > a ? m.count : a), 0)
  const first = bars[0]?.month
  const last = bars[bars.length - 1]?.month
  return (
    <View style={styles.card}>
      <AuroraBed width={CARD_W} height={CARD_H} cardStyle={cardStyle} />
      {/* El número del tiempo gigante, de fondo y de lado (como el signo en
          la Constelación). */}
      <Text style={styles.ghost} numberOfLines={1}>
        {duration.value}
      </Text>
      <View style={styles.pathPad}>
        <ShareTopRow right={shortMonthYear(afterIso)} accent={accent} />
        <Text style={[styles.titleKicker, styles.left, styles.pathKickerGap, { color: gold }]}>
          mi camino
        </Text>
        <Text style={[styles.titleBig, styles.left]} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
        {bars.length > 1 && best > 0 ? (
          <>
            <View style={styles.chart}>
              {bars.map((m) => (
                <View
                  key={m.month}
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(4, Math.round((m.count / max) * 100))}%`,
                      backgroundColor: accent,
                      opacity: m.count > 0 ? 0.95 : 0.25,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.axis}>
              <Text style={styles.axisText}>{first ? monthTag(first) : ''}</Text>
              <Text style={styles.axisText}>{last ? monthTag(last) : ''}</Text>
            </View>
          </>
        ) : null}
        <View style={styles.stickersRow}>
          {workoutsLabel ? (
            <Sticker accent={accent} onAccent={cardStyle.onAccent} inline>
              {`${workoutsTotal} ${workoutsTotal === 1 ? 'entreno' : 'entrenos'}`}
            </Sticker>
          ) : null}
          {best > 0 ? (
            <Sticker light inline>
              {`mejor mes: ${best}`}
            </Sticker>
          ) : null}
          {weight ? (
            <Sticker light inline>
              {weight}
            </Sticker>
          ) : null}
        </View>
      </View>
      <View style={styles.footer}>
        <ShareSignature label={`DESDE ${shortMonthYear(beforeIso)}`} />
      </View>
    </View>
  )
}

/** Sticker derecho (nunca inclinado): claro o del color del acento. */
function Sticker({
  children,
  light = false,
  accent,
  onAccent,
  inline = false,
  style,
}: {
  children: React.ReactNode
  light?: boolean
  accent?: string
  onAccent?: string
  inline?: boolean
  style?: object
}) {
  return (
    <View
      style={[
        styles.sticker,
        !inline && styles.stickerAbs,
        { backgroundColor: light ? colors.leche : (accent ?? colors.magenta) },
        style,
      ]}
    >
      <Text style={[styles.stickerText, { color: light ? '#1A0A10' : (onAccent ?? '#FFFFFF') }]}>
        {children}
      </Text>
    </View>
  )
}

function Photo({ url, onSettled, ring }: { url: string; onSettled: () => void; ring?: string }) {
  return (
    <View style={[styles.splitCell, ring ? { borderColor: ring, borderWidth: 2 } : null]}>
      <Image
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={onSettled}
        onError={onSettled}
      />
    </View>
  )
}

/** '2024-08-15' → "ago 2024". */
function shortDate(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number]
  return `${MONTHS_SHORT[m - 1]} ${y}`
}

/** '2024-08' → "AGO 24". */
function monthTag(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return `${(MONTHS_SHORT[m - 1] ?? '').toUpperCase()} ${String(y).slice(2)}`
}

const SPLIT_H = Math.round(CARD_H * 0.6)

const styles = StyleSheet.create({
  card: { width: CARD_W, height: CARD_H, overflow: 'hidden', backgroundColor: colors.bg },
  footer: { marginTop: 'auto', paddingBottom: 28 },
  footerAbs: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  left: { textAlign: 'left', alignSelf: 'flex-start' },
  titleBlock: { marginTop: 22, alignItems: 'center', paddingHorizontal: 20 },
  titleKicker: {
    fontFamily: typography.serifSemi,
    fontSize: typography.sizes.displaySm,
    textAlign: 'center',
  },
  titleBig: {
    fontFamily: typography.display,
    fontSize: 46,
    letterSpacing: -1.5,
    color: colors.leche,
    textAlign: 'center',
  },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  overlayTop: { position: 'absolute', top: 34, left: 22, right: 22 },
  sticker: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  stickerAbs: { position: 'absolute', zIndex: 4 },
  stickerText: { fontFamily: typography.uiBold, fontSize: typography.sizes.body },
  stickersRow: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ghost: {
    position: 'absolute',
    top: CARD_H / 2 - 110,
    right: -40,
    fontFamily: typography.display,
    fontSize: 260,
    letterSpacing: -12,
    color: 'rgba(244, 236, 222, 0.04)',
    transform: [{ rotate: '-90deg' }],
  },
  pathKickerGap: { marginTop: 44 },
  // ── Transformación ─────────────────────────────────────────────
  split: { flexDirection: 'row', height: SPLIT_H, gap: 3 },
  splitCell: { flex: 1, overflow: 'hidden', backgroundColor: colors.bgCard2 },
  tag: {
    position: 'absolute',
    top: 72,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 7,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
  },
  tagBefore: { backgroundColor: 'rgba(10, 6, 8, 0.72)', color: colors.leche },
  photoDate: {
    position: 'absolute',
    bottom: 10,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.leche,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowRadius: 6,
  },
  // ── Retrato ────────────────────────────────────────────────────
  retratoTop: { paddingTop: 34, paddingHorizontal: 22 },
  polaroid: {
    position: 'absolute',
    top: 84,
    right: 18,
    width: 104,
    padding: 6,
    paddingBottom: 22,
    borderRadius: 6,
    backgroundColor: colors.leche,
    transform: [{ rotate: '7deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  polaroidImg: { width: 92, height: 120, borderRadius: 3, backgroundColor: colors.bgCard2 },
  polaroidCaption: {
    position: 'absolute',
    bottom: 3,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: typography.serifSemi,
    fontSize: typography.sizes.body,
    color: '#2A1418',
  },
  retratoText: { position: 'absolute', left: 22, right: 22, bottom: 66 },
  // ── Tu camino ──────────────────────────────────────────────────
  pathPad: { paddingTop: 34, paddingHorizontal: 22 },
  chart: {
    marginTop: 28,
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
  },
  // Con pocos meses las barras no se vuelven bloques: ancho tope.
  bar: { flex: 1, maxWidth: 22, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axis: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  axisText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.5,
    color: colors.niebla,
  },
})
