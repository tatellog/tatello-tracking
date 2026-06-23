import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { useMacroTargets } from '@/features/macros/hooks'
import { colors, typography } from '@/theme'

import { useIsoWeekSignals } from '../hooks'
import {
  buildWeekDimensions,
  buildWeekFindings,
  dimDetail,
  dimensionLine,
  mostRepeated,
  risingSignal,
  type DayCell,
  type WeekDimKey,
} from '../week-orbit-logic'
import { consumeWeekFocus } from '../pending-week-focus'
import { EmptySegmentCard } from './EmptySegmentCard'
import { WeekOrbitGalaxy } from './WeekOrbitGalaxy'
import { hexA, weekDimGlyph, WEEK_DIM_COLOR } from './week-dim-visual'

/*
 * Órbita · Semana — "¿Qué se repitió esta semana?".
 *
 * Rediseño orbital: la galaxia es la primera aparición fuerte del lenguaje
 * de Órbita. Cada dimensión es un orbe cuya masa = días presentes esta
 * semana. Debajo, evidencia escaneable: lo que más se repitió, lo que pide
 * atención, la semana en una línea (aparición por día) y hallazgos
 * determinísticos. Sin IA, sin predicción — solo datos reales.
 */
export function WeekSegment({ onOpenDia }: { onOpenDia?: () => void }) {
  const { data: signals, todayIso, isLoading } = useIsoWeekSignals()
  const macros = useMacroTargets()
  const proteinTarget = macros.data?.protein_g ?? null

  const week = useMemo(() => signals ?? [], [signals])
  const dims = useMemo(
    () => buildWeekDimensions(week, todayIso, { proteinTarget }),
    [week, todayIso, proteinTarget],
  )
  // Señal Naciente (lo que crece vs. la semana pasada); si no hay, el Ancla
  // (lo más constante) — reemplazan al par "más se repitió / necesita atención"
  // que solo duplicaba el tamaño de las estrellas.
  const rising = useMemo(
    () => risingSignal(week, todayIso, { proteinTarget }),
    [week, todayIso, proteinTarget],
  )
  const anchor = useMemo(() => mostRepeated(dims), [dims])
  const findings = useMemo(() => buildWeekFindings(week, todayIso), [week, todayIso])

  const hasEvidence = dims.some((d) => d.present > 0)

  // Dimensión enfocada (estrella tocada) → muestra su readout, como Día.
  // Arranca con la dimensión que pidió un deep-link de patrón ("Verlo en mi
  // órbita"), si lo hubo: así aterrizas con esa estrella ya enfocada y su
  // evidencia visible. consumeWeekFocus se limpia al leer (one-shot).
  const [focusedDim, setFocusedDim] = useState<WeekDimKey | null>(() => consumeWeekFocus())
  const focused = focusedDim ? (dims.find((d) => d.key === focusedDim) ?? null) : null

  if (isLoading) {
    return <View style={styles.wrap} />
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Hero — el título orbital + la galaxia de evidencia. */}
      <View style={styles.hero}>
        <EmText
          text="Tu órbita esta semana"
          emphasis="órbita"
          style={styles.title}
          emStyle={styles.titleEm}
        />
        <Text style={styles.subtitle}>Las huellas que dejaron tus hábitos.</Text>
      </View>

      {/* Sin auto-enfoque: arranca mostrando la galaxia completa, nada
          seleccionado. El readout aparece solo cuando la usuaria toca. */}
      <WeekOrbitGalaxy dims={dims} onFocusChange={setFocusedDim} initialFocus={focusedDim} />
      {hasEvidence && focused ? (
        <>
          <Animated.View
            key={focused.key}
            entering={FadeInDown.duration(320)}
            style={styles.readout}
          >
            <Text style={[styles.readoutLabel, { color: WEEK_DIM_COLOR[focused.key] }]}>
              {focused.label}
            </Text>
            <Text style={styles.readoutDetail}>
              {dimDetail(focused.key, focused.present, focused.total)}
            </Text>
            <DayLine cells={dimensionLine(week, todayIso, focused.key, { proteinTarget })} />
          </Animated.View>
          <Text style={styles.tapHint}>Toca afuera para ver toda tu órbita.</Text>
        </>
      ) : hasEvidence ? (
        <Text style={styles.tapHint}>Toca una estrella para ver su hábito.</Text>
      ) : null}

      {!hasEvidence ? (
        <EmptySegmentCard
          eyebrow="La galaxia se enciende con tu registro"
          body="Esta semana aún está en silencio. Registra desde Hoy y cada hábito gana masa según los días que aparece."
          hint="Cuando algo se repita, lo verás crecer aquí."
        />
      ) : (
        <>
          {/* Señal Naciente — lo que EMERGE vs. la semana pasada (la lectura
              que la galaxia no verbaliza). Si no hay tendencia o es semana 1,
              cae a Tu Ancla: lo más constante. */}
          {rising ? (
            <ReliquiaBlock
              eyebrow="Señal naciente"
              dimKey={rising.key}
              label={rising.label}
              count={`de ${rising.last} a ${rising.current} días`}
              line={`Tu ${rising.label} apareció más que la semana pasada.`}
            />
          ) : anchor ? (
            <ReliquiaBlock
              eyebrow="Tu ancla"
              dimKey={anchor.dim.key}
              label={anchor.dim.label}
              count={`${anchor.dim.present} de ${anchor.dim.total} días`}
              line={anchor.line}
            />
          ) : null}

          {/* Otros hallazgos — hechos determinísticos de la semana. */}
          {findings.length > 0 ? (
            <View style={styles.block}>
              <Text style={[styles.eyebrow, styles.eyebrowOro]}>Otros hallazgos</Text>
              <View style={styles.findings}>
                {findings.map((f, i) => (
                  <Animated.View
                    key={f.key}
                    entering={FadeIn.duration(380).delay(i * 90)}
                    style={styles.findingRow}
                  >
                    <Text style={styles.findingStar}>✦</Text>
                    <Text style={styles.findingText}>{f.text}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}

      {onOpenDia ? (
        <Pressable onPress={onOpenDia} hitSlop={8} style={styles.diaLink}>
          <Text style={styles.diaLinkText}>Ver un día en detalle ›</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

/* Una Reliquia Celeste (Señal Naciente / Ancla): el glyph en su orbe de
 * color, la etiqueta grande coloreada, el dato y la frase de evidencia. */
function ReliquiaBlock({
  eyebrow,
  dimKey,
  label,
  count,
  line,
}: {
  eyebrow: string
  dimKey: WeekDimKey
  label: string
  count: string
  line: string
}) {
  const color = WEEK_DIM_COLOR[dimKey]
  return (
    <View style={styles.block}>
      <Text style={[styles.eyebrow, styles.eyebrowOro]}>{eyebrow}</Text>
      <View style={styles.hlCard}>
        <View
          style={[
            styles.hlOrb,
            { backgroundColor: hexA(color, 0.16), borderColor: hexA(color, 0.9) },
          ]}
        >
          {weekDimGlyph(dimKey, 40)}
        </View>
        <View style={styles.hlBody}>
          <Text style={[styles.hlLabel, { color }]}>{label}</Text>
          <Text style={styles.hlCount}>{count}</Text>
          <Text style={styles.hlLine}>{line}</Text>
        </View>
      </View>
    </View>
  )
}

/* La semana en una línea: 7 columnas (lun→dom), letra arriba + celda de
 * aparición. Presente = punto encendido (leche); ausente = aro vacío;
 * futuro = punto tenue (aún no llega, nunca falla). */
function DayLine({ cells }: { cells: readonly DayCell[] }) {
  return (
    <View style={styles.dayLine}>
      {cells.map((c, i) => (
        <View key={i} style={styles.dayCol}>
          <Text style={[styles.dayLetter, c.state === 'future' && styles.dayLetterFuture]}>
            {c.letter}
          </Text>
          <View
            style={[
              styles.dayMark,
              c.state === 'present' && styles.dayPresent,
              c.state === 'absent' && styles.dayAbsent,
              c.state === 'future' && styles.dayFuture,
            ]}
          >
            {c.state === 'present' ? <Text style={styles.dayCheck}>✓</Text> : null}
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  // ── Hero ──────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: typography.displayMedium,
    fontSize: 24,
    color: colors.leche,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  titleEm: {
    color: colors.magenta,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
  },
  tapHint: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // Readout de la dimensión enfocada — info al tocar una estrella (como Día).
  readout: {
    marginTop: 14,
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  readoutLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  readoutDetail: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
    lineHeight: typography.sizes.bodyLarge * 1.45,
  },
  // ── Bloques ───────────────────────────────────────────────────────
  block: {
    marginTop: 26,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
    marginLeft: 2,
  },
  eyebrowOro: {
    color: colors.oro,
  },
  // Highlight (más repetido / atención)
  hlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 16,
  },
  hlOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hlBody: {
    flex: 1,
    minWidth: 0,
  },
  hlLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
  },
  hlCount: {
    marginTop: 2,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  hlLine: {
    marginTop: 4,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    lineHeight: typography.sizes.body * 1.5,
  },
  // Semana en una línea
  dayLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  dayCol: {
    alignItems: 'center',
    gap: 9,
  },
  dayLetter: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
  dayLetterFuture: {
    color: colors.bruma,
  },
  dayMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPresent: {
    backgroundColor: colors.magenta,
  },
  dayAbsent: {
    borderWidth: 1.5,
    borderColor: colors.bruma,
  },
  dayFuture: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: hexA(colors.leche, 0.12),
  },
  dayCheck: {
    fontFamily: typography.uiBold,
    fontSize: 12,
    color: colors.leche,
  },
  // Otros hallazgos
  findings: {
    gap: 12,
  },
  findingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  findingStar: {
    fontFamily: typography.ui,
    fontSize: 13,
    color: colors.oro,
    marginTop: 1,
  },
  findingText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    lineHeight: typography.sizes.bodyLarge * 1.5,
  },
  // Footer link
  diaLink: {
    alignSelf: 'center',
    marginTop: 28,
  },
  diaLinkText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
