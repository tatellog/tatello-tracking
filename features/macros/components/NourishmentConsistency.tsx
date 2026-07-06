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
  /** Vasos directos de HOY + sumar uno — convierte la fila de Agua en
   *  acción ("vi mi tira floja → registré ya"), no solo espejo. */
  todayGlasses?: number
  onAddGlass?: () => void
}

/*
 * "Lo que alimenta tu transformación" — the consistency band in Comidas.
 *
 * Rediseño (feedback beta 2026-07-05: "leo bug, no matiz"): el matiz
 * "registré pero no llegué" vivía en la OPACIDAD del magenta y se leía
 * como decoración o como error. Ahora:
 *   · presencia = existe barra; logro = ALTURA de relleno (geometría,
 *     patrón Apple: el arco a medias se auto-explica). El color nunca
 *     cambia de significado.
 *   · la ventana se nombra ("ÚLTIMOS 7 DÍAS") y cada barra ancla a su
 *     día real con iniciales L-D; hoy va marcado y NO se juzga (su
 *     barra vive en directo, el conteo solo mira días cerrados).
 *   · la meta es visible por fila ("Referencia: 120 g") — "llegaste"
 *     sin el número no significa nada (excepción de Comidas vigente).
 *   · el texto cuenta EXACTAMENTE lo que las barras muestran.
 * Un día corto jamás es rojo ni veredicto; un día vacío es ausencia de
 * datos, no falla.
 */
export function NourishmentConsistency({
  data,
  isLoading,
  isError,
  onAddReference,
  todayGlasses,
  onAddGlass,
}: Props) {
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
        {data.protein && data.proteinTarget != null ? (
          <ScoreRow
            label="Proteína"
            meta={`Referencia: ${Math.round(data.proteinTarget)} g`}
            metaPhrase={`tus ${Math.round(data.proteinTarget)} g`}
            score={data.protein}
            glyph={<ProteinGlyph />}
          />
        ) : (
          <InviteRow onPress={onAddReference} />
        )}
        <ScoreRow
          label="Agua"
          meta={`Meta: ${data.waterGoalGlasses} vasos`}
          metaPhrase={`tus ${data.waterGoalGlasses} vasos`}
          score={data.agua}
          glyph={<AguaGlyph />}
          today={
            onAddGlass && todayGlasses != null ? (
              <View style={styles.todayRow}>
                <Text style={styles.todayText}>
                  Hoy: {todayGlasses} de {data.waterGoalGlasses}
                </Text>
                <Pressable
                  onPress={onAddGlass}
                  hitSlop={8}
                  style={styles.addGlass}
                  accessibilityRole="button"
                  accessibilityLabel="Sumar un vaso de agua a hoy"
                >
                  <Text style={styles.addGlassLabel}>+1 vaso</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>Lo que alimenta tu transformación</Text>
        <Text style={styles.window}>Últimos 7 días</Text>
      </View>
      {body}
    </View>
  )
}

// Mínimo de días CERRADOS registrados para mostrar un conteo: con menos aún
// no hay señal de consistencia (mostrar "0 de 2" desmotiva sin informar).
const MIN_LOGGED = 3

/* Un bloque por nutriente: cabecera (glifo · nombre · meta visible), la
 * tira de barras con iniciales de día, y la frase que cuenta EXACTAMENTE
 * lo que la tira muestra (denominador = días registrados CERRADOS). */
function ScoreRow({
  label,
  meta,
  metaPhrase,
  score,
  glyph,
  today,
}: {
  label: string
  meta: string
  metaPhrase: string
  score: ConsistencyScore
  glyph: ReactElement
  /** Fila de acción de HOY (solo Agua por ahora): dato + tap-para-sumar. */
  today?: ReactElement | null
}) {
  let caption: string
  if (score.logged === 0) {
    caption = 'Conforme registres, tus días se dibujan aquí.'
  } else if (score.logged < MIN_LOGGED) {
    caption = `Llevas ${score.logged} ${score.logged === 1 ? 'día registrado' : 'días registrados'}. Con algunos más, tu tendencia se dibuja sola.`
  } else if (score.reached === 0) {
    // El caso que se leía como bug: nombra PRIMERO lo que las barras
    // muestran (registraste), luego el umbral con su número, y deja hoy
    // abierto — imagen y texto por fin cuentan lo mismo.
    caption = `Registraste ${score.logged} días. Ninguno llegó aún a ${metaPhrase}. Hoy sigue abierto.`
  } else {
    caption = `Llegaste ${score.reached} de los ${score.logged} días que registraste.`
  }
  return (
    <View style={styles.scoreBlock}>
      <View style={styles.scoreHeader}>
        <View style={styles.glyphBox}>{glyph}</View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <View style={styles.scoreBody}>
        <Bars score={score} />
        <Text style={styles.caption}>{caption}</Text>
        {today ?? null}
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

/** Inicial del día real de una fecha local (D L M X J V S). */
const WEEKDAY_INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const
function weekdayInitial(date: string): string {
  return WEEKDAY_INITIALS[new Date(`${date}T00:00:00`).getDay()] ?? ''
}

/* Una barra por día (viejo→nuevo, hoy al final): track fijo + relleno que
 * SUBE con el progreso real. Llegaste = llena; registraste sin llegar =
 * parcial (la geometría se auto-explica); sin registro = solo el track.
 * Hoy lleva contorno (vivo, sin juicio) y su inicial en leche. */
function Bars({ score }: { score: ConsistencyScore }) {
  const lastIdx = score.days.length - 1
  return (
    <View>
      <View style={styles.bars}>
        {score.days.map((d, i) => {
          // Techo del parcial en 70%: lleno y casi-lleno jamás se confunden
          // (a 18px de track, 80% vs 100% eran ~4px — el mismo bug de canal
          // en versión suave).
          const fill =
            d.state === 'reached'
              ? 1
              : d.state === 'short'
                ? Math.min(0.7, Math.max(0.25, d.ratio))
                : 0
          return (
            <View key={d.date} style={[styles.barTrack, i === lastIdx && styles.barTrackToday]}>
              {fill > 0 ? (
                <View style={[styles.barFill, { height: `${Math.round(fill * 100)}%` }]} />
              ) : null}
            </View>
          )
        })}
      </View>
      <View style={styles.initials}>
        {score.days.map((d, i) => (
          <Text key={d.date} style={[styles.initial, i === lastIdx && styles.initialToday]}>
            {weekdayInitial(d.date)}
          </Text>
        ))}
      </View>
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
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  eyebrow: {
    flexShrink: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  // La ventana, nombrada: nadie deduce ventanas, se leen.
  window: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 1.2,
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
    gap: 18,
  },
  scoreBlock: {
    gap: 8,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBody: {
    paddingLeft: 26,
    gap: 7,
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
    marginLeft: 6,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  // La referencia visible — sin ella "llegaste" no significa nada.
  meta: {
    flex: 1,
    textAlign: 'right',
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // Tira de 7 barras a todo lo ancho, una por día real. 24px de alto:
  // suficiente recorrido para que parcial (≤70%) y lleno se lean a un metro.
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 24,
  },
  // El track: existe siempre (día sin registro = solo track, ausencia de
  // datos, jamás "fallo"). El relleno crece desde abajo.
  barTrack: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 3,
    backgroundColor: colors.hairline,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  // Hoy: contorno vivo — está en curso, no se juzga.
  barTrackToday: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bone,
  },
  barFill: {
    width: '100%',
    borderRadius: 3,
    backgroundColor: colors.magenta,
  },
  initials: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
  },
  initial: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.ui,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
    letterSpacing: 0.4,
  },
  initialToday: {
    fontFamily: typography.uiSemi,
    color: colors.leche,
  },
  invite: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // "Hoy: 3 de 8 · [+1 vaso]" — la tira floja con su acción al lado.
  todayRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  addGlass: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard2,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  addGlassLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  // La frase cuenta lo MISMO que las barras (denominador = días cerrados
  // registrados). Texto-ayuda en Hanken upright, tenue.
  caption: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    lineHeight: typography.sizes.label * 1.35,
    color: colors.niebla,
  },
})
