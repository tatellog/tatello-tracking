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
          <ScoreRow
            label="Proteína"
            meaning="lo que sostiene tu músculo"
            score={data.protein}
            glyph={<ProteinGlyph />}
          />
        ) : (
          <InviteRow onPress={onAddReference} />
        )}
        <ScoreRow
          label="Agua"
          meaning="lo que sostiene tu energía"
          score={data.agua}
          glyph={<AguaGlyph />}
        />
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

// Mínimo de días registrados para mostrar un conteo: con menos que esto aún
// no hay señal de consistencia, solo una invitación a seguir registrando
// (mostrar "0 de 2" desmotiva sin informar).
const MIN_LOGGED = 4

/* Un bloque por nutriente: cabecera (glifo · nombre), una línea cálida de
 * POR QUÉ importa, la tira de días, y la frase de avance. El "avance de qué"
 * se entiende: el denominador son los días que REGISTRASTE, no 10 de
 * calendario, así que no castiga el no-registrar. */
function ScoreRow({
  label,
  meaning,
  score,
  glyph,
}: {
  label: string
  meaning: string
  score: ConsistencyScore
  glyph: ReactElement
}) {
  // Gateo: con pocos días de datos no hay consistencia que puntuar — invita
  // a registrar en vez de mostrar un score frío. Con datos: la frase dice
  // que el número son DÍAS, sobre los días REGISTRADOS (no de 10), y nunca
  // un "0 de N" a secas (la línea de 0 mira hacia adelante).
  let caption: string
  if (score.logged < MIN_LOGGED) {
    caption = 'Conforme registres, tus días se irán dibujando aquí.'
  } else if (score.reached === 0) {
    caption = `Aún ninguno de los ${score.logged} días que registraste. Cada uno cuenta.`
  } else {
    caption = `La alcanzaste ${score.reached} de los ${score.logged} días que registraste.`
  }
  return (
    <View style={styles.scoreBlock}>
      <View style={styles.scoreHeader}>
        <View style={styles.glyphBox}>{glyph}</View>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.scoreBody}>
        {/* Por qué importa — voz cálida (serif italic), no clínica. */}
        <Text style={styles.meaning}>{meaning}</Text>
        <Dots score={score} />
        <Text style={styles.caption}>{caption}</Text>
      </View>
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

/* Un punto por día de la ventana (viejo→nuevo), en SU día real. Tres
 * estados: 'reached' = lleno magenta (registraste y llegaste), 'short' =
 * magenta tenue (registraste, aún no llegaste), 'empty' = hairline (sin
 * registro — no es falla, es ausencia de datos). Distinguir 'short' de
 * 'empty' es la clave: "no llegué" no se ve igual que "no registré". */
function Dots({ score }: { score: ConsistencyScore }) {
  return (
    <View style={styles.dots}>
      {score.days.map((state, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            state === 'reached'
              ? styles.dotReached
              : state === 'short'
                ? styles.dotShort
                : styles.dotEmpty,
          ]}
        />
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
    gap: 16,
  },
  // Bloque por nutriente: cabecera + cuerpo (significado + tira de días).
  scoreBlock: {
    gap: 7,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Cuerpo sangrado bajo el nombre (alineado tras el glifo): significado
  // arriba, tira de días abajo.
  scoreBody: {
    paddingLeft: 26,
    gap: 7,
  },
  // La fila del invite sigue siendo horizontal (glifo · nombre · invite).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyphBox: {
    width: 20,
    alignItems: 'center',
  },
  label: {
    marginLeft: 6,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  // Por qué importa el nutriente — voz cálida (serif italic), niebla.
  meaning: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // Tira de 10 días a todo lo ancho — segmentos parejos = "10 días" obvio.
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  // Llegaste — magenta pleno.
  dotReached: {
    backgroundColor: colors.magenta,
  },
  // Registraste pero corto — magenta tenue (presente, aún no llegaste).
  dotShort: {
    backgroundColor: `${colors.magenta}59`,
  },
  // Sin registro — hairline, sin juicio.
  dotEmpty: {
    backgroundColor: colors.hairline,
  },
  invite: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // Qué es el número — frase completa bajo la tira: "La alcanzaste 3 de tus
  // últimos 10 días". Texto-ayuda (Hanken upright, tenue): resuelve "1 qué".
  caption: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    lineHeight: typography.sizes.label * 1.35,
    color: colors.niebla,
  },
})
