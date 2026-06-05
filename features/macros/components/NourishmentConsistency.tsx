import { type ReactElement } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
  /** Tapped on the protein-invite row when no reference is set. */
  onAddReference?: () => void
}

/*
 * "Lo que alimenta tu transformación" — the consistency band in Comidas.
 *
 * Two read-only rows (Proteína + Agua — both real nutrients) over the
 * last 10 days, each a row of dots filled to the days fulfilled.
 * Reinforces CONSISTENCY, never scores it: an unmet day is just an unlit
 * dot, never red, never a verdict.
 *
 * When no protein reference is set, the protein row becomes a gentle
 * INVITE (not "0 de 10", which would read as failure, and not a single
 * lonely Agua row, which reads as a broken card). On error the card
 * stays put with a warm line — it never vanishes silently.
 */
export function NourishmentConsistency({ data, isLoading, isError, onAddReference }: Props) {
  let body: ReactElement
  if (isError) {
    body = (
      <Text style={styles.empty}>
        No pudimos reunir tus últimos días. Lo intentamos de nuevo en un momento.
      </Text>
    )
  } else if (data == null) {
    body = (
      <Text style={styles.empty}>
        {isLoading ? 'Reuniendo tus últimos días…' : 'Tus primeros días se irán dibujando aquí.'}
      </Text>
    )
  } else {
    body = (
      <View style={styles.rows}>
        {data.protein ? (
          <ScoreRow label="Proteína" score={data.protein} glyph={<ProteinGlyph />} />
        ) : (
          <InviteRow onPress={onAddReference} />
        )}
        <ScoreRow label="Agua" score={data.agua} glyph={<AguaGlyph />} />
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Lo que alimenta tu transformación</Text>
      {body}
    </View>
  )
}

/* One fulfilled-days row: glyph · label · dots · "X de N". */
function ScoreRow({
  label,
  score,
  glyph,
}: {
  label: string
  score: ConsistencyScore
  glyph: ReactElement
}) {
  return (
    <View style={styles.row}>
      <View style={styles.glyphBox}>{glyph}</View>
      <Text style={styles.label}>{label}</Text>
      <Dots score={score} />
      <Text style={styles.count}>
        {score.hit} <Text style={styles.countOf}>de {score.total}</Text>
      </Text>
    </View>
  )
}

/* The protein row when there's no reference yet — a soft invite that
 * keeps the card balanced (two rows) without ever showing "0 de 10". */
function InviteRow({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel="Añadir una referencia de proteína"
    >
      <View style={styles.glyphBox}>
        <ProteinGlyph />
      </View>
      <Text style={styles.label}>Proteína</Text>
      <Text style={styles.invite}>Añade una referencia{onPress ? ' ›' : ''}</Text>
    </Pressable>
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
    // Slightly less air than before: the hero's bottom fade is now a soft
    // 0.78 wash (not a hard black cut), so it already eases into the card —
    // 22 read as a gap. Softer hairline so it reads as a panel condensing
    // out of the sky, not a foreign box.
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
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
  invite: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
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
