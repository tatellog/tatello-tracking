import { type ReactElement } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import type {
  ConsistencyScore,
  NourishmentConsistency as NourishmentConsistencyData,
} from '../nourishment'
import { colors, typography } from '@/theme'

type Props = {
  data: NourishmentConsistencyData | null
  isLoading: boolean
  isError: boolean
}

/*
 * "Lo que alimenta tu transformación" — the consistency band in Comidas.
 *
 * Three read-only rows (Proteína / Registro / Agua) over the last 10
 * days, each a row of dots filled to the days fulfilled. Reinforces
 * CONSISTENCY, never scores it: an unmet day is just an unlit dot, never
 * red, never a verdict. The protein row is hidden entirely when no
 * reference is set (showing "0 de 10" would read as failure).
 */
export function NourishmentConsistency({ data, isLoading, isError }: Props) {
  if (isError) return null

  const rows = data
    ? [
        data.protein
          ? { key: 'protein', label: 'Proteína', score: data.protein, glyph: <ProteinGlyph /> }
          : null,
        { key: 'agua', label: 'Agua', score: data.agua, glyph: <AguaGlyph /> },
      ].filter(
        (r): r is { key: string; label: string; score: ConsistencyScore; glyph: ReactElement } =>
          Boolean(r),
      )
    : []

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Lo que alimenta tu transformación</Text>

      {data == null ? (
        <Text style={styles.empty}>
          {isLoading ? 'Reuniendo tus últimos días…' : 'Aún no hay días que mostrar.'}
        </Text>
      ) : (
        <View style={styles.rows}>
          {rows.map((row) => (
            <View key={row.key} style={styles.row}>
              <View style={styles.glyphBox}>{row.glyph}</View>
              <Text style={styles.label}>{row.label}</Text>
              <Dots score={row.score} />
              <Text style={styles.count}>
                {row.score.hit} <Text style={styles.countOf}>de {row.score.total}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/* A row of `total` dots, the first `hit` lit. Lit = magenta, unlit =
 * hairline. No "missing" colour: an unlit dot is simply a day still
 * open, never a failure. */
function Dots({ score }: { score: ConsistencyScore }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: score.total }, (_, i) => (
        <View key={i} style={[styles.dot, i < score.hit ? styles.dotOn : styles.dotOff]} />
      ))}
    </View>
  )
}

/* ── Minimal line glyphs (no emoji, currentColor-style tint) ── */
const GLYPH = colors.bone

function ProteinGlyph() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={7} stroke={GLYPH} strokeWidth={1.6} fill="none" />
      <Circle cx={12} cy={12} r={2.4} fill={GLYPH} />
    </Svg>
  )
}

function AguaGlyph() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path
        d="M12 3 C12 3 5.5 10.5 5.5 15 a6.5 6.5 0 0 0 13 0 C18.5 10.5 12 3 12 3 Z"
        stroke={GLYPH}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  empty: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  rows: {
    marginTop: 14,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyphBox: {
    width: 20,
    alignItems: 'center',
  },
  label: {
    width: 74,
    marginLeft: 6,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    maxWidth: 14,
  },
  dotOn: {
    backgroundColor: colors.magenta,
  },
  dotOff: {
    backgroundColor: colors.hairline,
  },
  count: {
    width: 58,
    textAlign: 'right',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  countOf: {
    fontFamily: typography.uiMedium,
    color: colors.niebla,
  },
})
