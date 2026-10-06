import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { ZodiacArt } from '@/features/tabs/components/constellation/ZodiacArt'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

import { monthCellPosition } from '../share-logic'
import type { ShareCardStyle } from '../share-styles'
import { AuroraBed, ShareSignature, ShareTopRow, shortMonthYear } from './share-aurora'

/*
 * Las tarjetas de "Tu constancia" para historias (dueña 5 oct 2026):
 *   · Constelación — limpia y centrada: el arte del signo con su anillo de
 *     avance, el nombre, el % y dos chips. (La que la dueña eligió.)
 *   · Calendario — un número gigante y el mes donde cada día entrenado es una
 *     estrella (sin línea que las una: no se entendía, dueña 5 oct 2026).
 *   · Mi mes — bandas de color inclinadas tipo Wrapped: entrenos, minutos y
 *     días en déficit. Una banda sin dato no se pinta (nunca un cero).
 * 9:16 fijo, todo dentro de la zona segura de historias.
 */

// El mismo marco 9:16 que TRAINING_CARD_W/H (no se importa: TrainingShareCard
// importa este archivo y el ciclo dejaría las constantes sin valor al evaluar).
const W = 320
const H = Math.round((W * 16) / 9)
const PAD = 24
const MONTHS_LOWER = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const STAR_PATH = 'M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z'

/* ── Constelación ─────────────────────────────────────────────────────── */

const ART_BOX = 236
const RING_R = ART_BOX / 2 - 4
const RING_C = 2 * Math.PI * RING_R

export function ConstellationCard({
  sign,
  signLabel,
  monthLabel,
  revealedPct,
  nextStarDay,
  trainedCount,
  cardStyle,
}: {
  sign: ZodiacSign
  signLabel: string
  monthLabel: string
  revealedPct: number
  nextStarDay: number | null
  trainedCount: number
  cardStyle: ShareCardStyle
}) {
  const [accent, , gold] = cardStyle.aurora
  const lit = revealedPct > 0
  return (
    <View style={styles.card}>
      <AuroraBed width={W} height={H} cardStyle={cardStyle} />
      {/* El nombre del signo gigante, de fondo y de lado (versión 2 de la
          maqueta que eligió la dueña). Relleno muy tenue: RN no tiene contorno. */}
      <Text style={styles.ghost} numberOfLines={1}>
        {signLabel}
      </Text>
      <ShareTopRow right={shortMonthYear(todayOf(monthLabel))} accent={accent} />
      <View style={[styles.artBox, styles.artCentered]}>
        <Svg width={ART_BOX} height={ART_BOX} style={StyleSheet.absoluteFill}>
          <Circle
            cx={ART_BOX / 2}
            cy={ART_BOX / 2}
            r={RING_R}
            stroke="rgba(244, 236, 222, 0.16)"
            strokeWidth={4}
            fill="none"
          />
          {lit ? (
            <Circle
              cx={ART_BOX / 2}
              cy={ART_BOX / 2}
              r={RING_R}
              stroke={accent}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${(RING_C * Math.min(100, revealedPct)) / 100} ${RING_C}`}
              rotation={-90}
              originX={ART_BOX / 2}
              originY={ART_BOX / 2}
            />
          ) : null}
        </Svg>
        <ZodiacArt sign={sign} size={190} halo="soft" />
      </View>
      {/* Los "stickers", derechos (la dueña no quiso texto chueco). */}
      {lit ? (
        <View style={[styles.sticker, styles.stickerLight, styles.stickerTopLeft]}>
          <Text style={styles.stickerDark}>
            {`${revealedPct}% `}
            <Text style={styles.stickerSerif}>revelado</Text>
          </Text>
        </View>
      ) : null}
      {lit && nextStarDay != null ? (
        <View style={[styles.sticker, styles.stickerRight, { backgroundColor: accent }]}>
          <Text style={[styles.stickerText, { color: cardStyle.onAccent }]}>
            {`próxima estrella → día ${nextStarDay}`}
          </Text>
        </View>
      ) : null}
      <View style={styles.titleBlock}>
        <Text style={[styles.titleKicker, { color: gold }]}>
          {lit ? 'mi cielo se enciende' : 'mi cielo empieza'}
        </Text>
        <Text style={styles.titleSign} numberOfLines={1} adjustsFontSizeToFit>
          {signLabel}
        </Text>
      </View>
      <View style={styles.footer}>
        <ShareSignature
          label={
            trainedCount > 0
              ? `${trainedCount} ${trainedCount === 1 ? 'ENTRENO' : 'ENTRENOS'} ESTE MES`
              : 'STELAR'
          }
        />
      </View>
    </View>
  )
}

/** "Octubre 2026" → '2026-10-01' (para la fecha corta de la fila de arriba). */
function todayOf(monthLabel: string): string {
  const [name, year] = monthLabel.split(' ')
  const idx = MONTHS_LOWER.indexOf((name ?? '').toLowerCase())
  return `${year ?? '2026'}-${String(Math.max(0, idx) + 1).padStart(2, '0')}-01`
}

/* ── Calendario-constelación ──────────────────────────────────────────── */

const GRID_W = W - PAD * 2
const CELL_W = GRID_W / 7
const ROW_H = 38
const STAR = 30
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function SkyCalendarCard({
  today,
  trainedDates,
  cardStyle,
}: {
  today: string
  trainedDates: readonly string[]
  cardStyle: ShareCardStyle
}) {
  const accent = cardStyle.aurora[0]
  const gold = cardStyle.aurora[2]
  const monthIso = today.slice(0, 7)
  const [y, m] = monthIso.split('-').map(Number) as [number, number]
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const todayNum = Number(today.slice(8, 10))
  const lit = new Set(
    trainedDates.filter((d) => d.startsWith(monthIso)).map((d) => Number(d.slice(8, 10))),
  )
  const litSorted = [...lit].sort((a, b) => a - b)
  const rows = monthCellPosition(monthIso, daysInMonth).row + 1
  const center = (day: number) => {
    const { col, row } = monthCellPosition(monthIso, day)
    return { x: col * CELL_W + CELL_W / 2, y: row * ROW_H + ROW_H / 2 }
  }
  const count = litSorted.length
  return (
    <View style={styles.card}>
      <AuroraBed width={W} height={H} cardStyle={cardStyle} />
      <ShareTopRow right={shortMonthYear(today)} accent={accent} />
      <Text style={styles.bigNum}>{count}</Text>
      <Text style={styles.bigSub}>
        {count === 1 ? 'día ' : 'días '}
        <Text style={[styles.serifAccent, { color: gold }]}>
          {count === 1 ? 'encendido' : 'encendidos'}
        </Text>
        {`\nen ${MONTHS_LOWER[m - 1]}`}
      </Text>

      <View style={styles.weekRow}>
        {WD.map((d) => (
          <Text key={d} style={styles.weekLetter}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ width: GRID_W, height: rows * ROW_H }}>
        {/* Una estrella por día entrenado (debajo de los números). */}
        <Svg width={GRID_W} height={rows * ROW_H} style={StyleSheet.absoluteFill}>
          {litSorted.map((d) => {
            const p = center(d)
            return (
              <Path
                key={d}
                d={STAR_PATH}
                fill={accent}
                x={p.x - STAR / 2}
                y={p.y - STAR / 2}
                scale={STAR / 24}
              />
            )
          })}
        </Svg>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const p = center(d)
          const on = lit.has(d)
          return (
            <Text
              key={d}
              style={[
                styles.dayNum,
                { left: p.x - CELL_W / 2, top: p.y - 8, width: CELL_W },
                on
                  ? [styles.dayNumOn, { color: cardStyle.onAccent }]
                  : d <= todayNum
                    ? styles.dayNumPast
                    : null,
              ]}
            >
              {d}
            </Text>
          )
        })}
      </View>
      <View style={styles.footer}>
        <ShareSignature label="MI CONSTANCIA" />
      </View>
    </View>
  )
}

/* ── Mi mes (bandas tipo Wrapped) ─────────────────────────────────────── */

export function MyMonthCard({
  today,
  trained,
  minutes,
  deficitDays,
  cardStyle,
}: {
  today: string
  trained: number
  minutes: number | null
  deficitDays: number | null
  cardStyle: ShareCardStyle
}) {
  const [accent, , gold] = cardStyle.aurora
  const month = MONTHS_LOWER[Number(today.slice(5, 7)) - 1] ?? ''
  const bands: {
    value: number
    label: string
    bg: string
    fg: string
    tilt: string
    shift: number
  }[] = []
  if (trained > 0)
    bands.push({
      value: trained,
      label: trained === 1 ? 'entreno' : 'entrenos',
      bg: accent,
      fg: cardStyle.onAccent,
      tilt: '-2.5deg',
      shift: 0,
    })
  if (minutes != null && minutes > 0)
    bands.push({
      value: minutes,
      label: 'minutos\nde movimiento',
      bg: colors.leche,
      fg: '#1A0A10',
      tilt: '1.5deg',
      shift: 6,
    })
  if (deficitDays != null && deficitDays > 0)
    bands.push({
      value: deficitDays,
      label: deficitDays === 1 ? 'día\nen déficit' : 'días\nen déficit',
      bg: gold,
      fg: '#1A0A10',
      tilt: '-1deg',
      shift: 0,
    })
  return (
    <View style={styles.card}>
      <AuroraBed width={W} height={H} cardStyle={cardStyle} />
      <ShareTopRow right={shortMonthYear(today)} accent={accent} />
      <Text style={styles.monthHead}>
        {`mi ${month}\n`}
        <Text style={[styles.serifAccentLg, { color: gold }]}>en movimiento</Text>
      </Text>
      <View style={styles.bands}>
        {bands.map((b) => (
          <View
            key={b.label}
            style={[
              styles.band,
              { backgroundColor: b.bg, transform: [{ rotate: b.tilt }, { translateX: b.shift }] },
            ]}
          >
            <Text style={[styles.bandNum, { color: b.fg }]}>{b.value}</Text>
            <Text style={[styles.bandLabel, { color: b.fg }]}>{b.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
    overflow: 'hidden',
    paddingHorizontal: PAD,
    paddingTop: 34,
    paddingBottom: 28,
  },
  footer: { marginTop: 'auto', alignSelf: 'stretch' },
  ghost: {
    position: 'absolute',
    top: H / 2 - 60,
    left: -H / 2 + W / 2,
    width: H,
    textAlign: 'center',
    fontFamily: typography.display,
    fontSize: 104,
    letterSpacing: 4,
    color: 'rgba(244, 236, 222, 0.035)',
    transform: [{ rotate: '-90deg' }],
  },
  artCentered: { alignSelf: 'center', marginTop: 40 },
  sticker: {
    position: 'absolute',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  stickerLight: { backgroundColor: colors.leche },
  stickerTopLeft: { top: 96, left: 14 },
  stickerRight: { top: 262, right: 10 },
  stickerDark: { fontFamily: typography.uiBold, fontSize: typography.sizes.body, color: '#1A0A10' },
  stickerSerif: { fontFamily: typography.serifSemi, fontSize: typography.sizes.ui },
  stickerText: { fontFamily: typography.uiBold, fontSize: typography.sizes.body },
  titleBlock: { marginTop: 22, alignItems: 'center' },
  titleKicker: { fontFamily: typography.serifSemi, fontSize: typography.sizes.displaySm },
  titleSign: {
    fontFamily: typography.display,
    fontSize: 46,
    letterSpacing: -1.5,
    color: colors.leche,
  },
  artBox: {
    marginTop: 26,
    width: ART_BOX,
    height: ART_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // lineHeight MAYOR que el tamaño: con uno menor iOS recorta el número
  // (pasaba con el "3"). El espaciado negativo se queda leve por lo mismo.
  bigNum: {
    marginTop: 8,
    paddingLeft: 2,
    fontFamily: typography.display,
    fontSize: 132,
    lineHeight: 156,
    letterSpacing: -3,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  bigSub: {
    marginTop: 2,
    fontFamily: typography.display,
    fontSize: typography.sizes.headingLg,
    lineHeight: 23,
    letterSpacing: -0.4,
    color: colors.leche,
  },
  serifAccent: {
    fontFamily: typography.serifSemi,
    fontSize: typography.sizes.displaySm,
    letterSpacing: 0,
  },
  serifAccentLg: {
    fontFamily: typography.serifSemi,
    fontSize: typography.sizes.displayLg,
    letterSpacing: 0,
  },
  weekRow: { marginTop: 22, flexDirection: 'row', width: GRID_W },
  weekLetter: {
    width: CELL_W,
    textAlign: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
    paddingBottom: 4,
  },
  dayNum: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    lineHeight: 16,
    color: 'rgba(244, 236, 222, 0.3)',
    fontVariant: ['tabular-nums'],
  },
  dayNumPast: { color: 'rgba(244, 236, 222, 0.62)' },
  dayNumOn: { fontSize: typography.sizes.tinyLabel, fontFamily: typography.display },
  monthHead: {
    marginTop: 22,
    fontFamily: typography.display,
    fontSize: typography.sizes.displayLg,
    lineHeight: 34,
    letterSpacing: -1,
    color: colors.leche,
  },
  bands: { marginTop: 24, gap: 12 },
  band: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  bandNum: {
    fontFamily: typography.display,
    fontSize: 54,
    lineHeight: 54,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums'],
  },
  bandLabel: {
    marginBottom: 6,
    textAlign: 'right',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 16,
  },
})
