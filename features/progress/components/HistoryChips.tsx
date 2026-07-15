import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { PROGRESS_COMPARE_WINDOW_DAYS } from '../constants'
import { useMeasurements } from '../hooks'
import {
  compareHistory,
  historySparklines,
  pickLeadChip,
  proteinAverageComparison,
  smoothWeightPoints,
  toWeightPoints,
} from '../logic'
import { Sparkline } from './Sparkline'

/*
 * "Tus últimos 30 días" (F1 · Progress 3.0, mockup dueña) — el 30v30 como GRID
 * DE CHIPS con mini-sparklines, estilo Apple Fitness Trends: auto-comparación
 * contra ti misma, el antídoto del abandono en semana 3 (los hábitos muestran
 * cambio antes que la báscula). UNA sola matemática: todo sale del Comparison
 * Engine puro (compareHistory / historySparklines / proteinAverageComparison).
 *
 * Color = IDENTIDAD por métrica (tokens de dimensión existentes), NUNCA juicio:
 * el mismo hue suba o baje; la dirección la dice ↑/↓ tipográfico. Sin verde/rojo
 * (benchmark + guardarraíl de epic-01). Reemplaza a TuHistoria (convergencia).
 */

type ChipDef = {
  key: string
  label: string
  hue: string
  prev: string
  curr: string
  spark: number[] | null
  /** Cambio relativo |ahora−antes|/antes — decide quién lidera. */
  significance: number
  /** ahora − antes: solo una MEJORA puede ganar el titular. */
  delta: number
}

const fmtCount = (n: number) => `${n}`
// Cambio relativo con dos guardas anti-ruido (manifesto-review): un delta
// menor a `minAbs` no compite por el titular (2 entrenos más no son historia),
// y el piso `floor` evita que un baseline chiquito infle el ratio (1→3 no
// debe ganarle a 10→18). Chasing de ruido mes a mes ≠ "la paciencia es el
// producto".
const significance = (prev: number, curr: number, minAbs: number, floor: number) =>
  Math.abs(curr - prev) >= minAbs ? Math.abs(curr - prev) / Math.max(prev, floor) : 0

export function HistoryChips() {
  const windowDays = PROGRESS_COMPARE_WINDOW_DAYS
  const signals = useSignalsHistory(windowDays * 2 + 5)
  const measurements = useMeasurements(null)
  const targets = useMacroTargets().data
  const today = todayInTimezone()

  const chips = useMemo<ChipDef[] | null>(() => {
    if (!signals.data) return null
    const ctx = {
      today,
      calorieTarget: targets?.calories ?? null,
      proteinTarget: targets?.protein_g ?? null,
      windowDays,
    }
    const summary = compareHistory(signals.data, measurements.data ?? [], ctx)
    const sparks = historySparklines(signals.data, ctx)
    const byKey = new Map(summary.metrics.map((m) => [m.key, m]))
    const out: ChipDef[] = []

    // Labels CON unidad ("Registro" a secas leía como "¿veces que abrí la
    // app?" · target-user). Sin fila de delta: la misma flecha significaba
    // cosas opuestas por chip (↓ peso bueno, ↓ déficit malo) y "antes/ahora"
    // ya cuenta la dirección.
    const counts: { key: 'workouts' | 'deficit' | 'logging'; label: string; hue: string }[] = [
      { key: 'deficit', label: 'Días en déficit', hue: colors.magentaHot },
      // "evidencia", no "registro": registro leía como asistencia escolar
      // (target-user) y "evidencia" es la palabra del hook del hero.
      { key: 'logging', label: 'Días con evidencia', hue: colors.dimension.alimento },
      // signal.entreno, NO dimension.cuerpo: ese alias es el mismo hex que
      // magentaHot y Entrenos clonaba el color de Días en déficit en el
      // mismo grid (auditoría: color = identidad).
      { key: 'workouts', label: 'Entrenos', hue: colors.signal.entreno },
    ]
    for (const c of counts) {
      const m = byKey.get(c.key)
      if (!m) continue
      out.push({
        key: c.key,
        label: c.label,
        hue: c.hue,
        prev: fmtCount(m.previous),
        curr: fmtCount(m.current),
        spark: sparks[c.key],
        significance: significance(m.previous, m.current, 3, 5),
        delta: m.current - m.previous,
      })
    }

    // Proteína en gramos promedio (el lenguaje del registro del coach).
    const prot = proteinAverageComparison(signals.data, ctx)
    if (prot) {
      out.push({
        key: 'protein',
        label: 'Proteína al día',
        hue: colors.signal.proteina,
        prev: `${prot.previous} g`,
        curr: `${prot.current} g`,
        spark: sparks.protein,
        significance: significance(prot.previous, prot.current, 10, 50),
        delta: prot.current - prot.previous,
      })
    }

    // Peso: suavizado (media 7d) para que el titular no sea ruido de báscula.
    // significance 0: el peso NUNCA lidera el grid (jamás dominante en home
    // ni en Historia · manifiesto); su historia vive en Cuerpo.
    const w = byKey.get('weight')
    if (w) {
      const smoothTail = smoothWeightPoints(toWeightPoints(measurements.data ?? []))
        .slice(-9)
        .map((p) => p.weight)
      out.push({
        key: 'weight',
        label: 'Peso',
        hue: colors.oroSoft,
        prev: `${w.previous.toFixed(1)} kg`,
        curr: `${w.current.toFixed(1)} kg`,
        spark: smoothTail.length >= 2 ? smoothTail : null,
        significance: 0,
        delta: 0,
      })
    }
    return out
  }, [signals.data, measurements.data, targets?.calories, targets?.protein_g, today, windowDays])

  if (!chips || chips.length === 0) return null

  // Jerarquía (patrón del anillo dominante de Apple, sin su presión): el
  // titular solo se GANA con mejora — en mes flojo no hay héroe y el grid
  // queda plano (pickLeadChip · target-user: "me sirve mi peor dato de
  // entrada, en gigante"). El peso nunca compite (significance 0).
  const lead = pickLeadChip(chips)
  const GRID_ORDER = ['deficit', 'logging', 'protein', 'weight', 'workouts']
  const rest = chips
    .filter((c) => c.key !== lead?.key)
    .sort((a, b) => GRID_ORDER.indexOf(a.key) - GRID_ORDER.indexOf(b.key))

  return (
    <Animated.View entering={FadeIn.duration(360)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tus últimos 30 días
      </EyebrowLabel>
      {/* En Hanken, NO cursiva: la cursiva es registro de coach y el ojo la
          salta buscando números — y esta línea es la llave de la sección
          (target-user: "la explicación estaba donde guardan la poesía"). */}
      <Text style={styles.sub}>comparado con los 30 días de antes</Text>
      {lead ? (
        <View style={[styles.chip, styles.leadChip]}>
          <Text style={[styles.chipLabel, { color: lead.hue }]}>{lead.label}</Text>
          <Text style={styles.prevLine}>antes {lead.prev}</Text>
          <View style={styles.currRow}>
            <Text style={styles.nowWord}>ahora</Text>
            <Text style={[styles.curr, styles.leadCurr]}>{lead.curr}</Text>
          </View>
          {lead.spark ? <Sparkline data={lead.spark} hue={lead.hue} width={120} /> : null}
        </View>
      ) : null}
      <View style={styles.grid}>
        {rest.map((c) => (
          <View key={c.key} style={styles.chip}>
            <Text style={[styles.chipLabel, { color: c.hue }]}>{c.label}</Text>
            <Text style={styles.prevLine}>antes {c.prev}</Text>
            <View style={styles.currRow}>
              <Text style={styles.nowWord}>ahora</Text>
              <Text style={styles.curr}>{c.curr}</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  eyebrow: { marginBottom: 2 },
  // Hanken upright: es DATO (la regla de la ventana), no voz de coach.
  sub: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // El chip líder: full-width, número más grande, sparkline más ancha (la
  // única que se queda: las mini de los chips eran decoración ilegible).
  leadChip: { marginBottom: 10 },
  leadCurr: { fontSize: typography.sizes.displayMd },
  // 2×2 (antes 30%: con cuatro chips, el último quedaba solo y estirado —
  // justo Entrenos, el que menos protagonismo debe tener).
  chip: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  chipLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
  },
  // "antes 13 · ahora 10": dos palabritas y la confusión desaparece
  // (target-user leyó "13 → 10" como "mi meta era 13"). Sin fila de delta ni
  // flecha ambigua; sin verde/rojo (identidad por hue, nunca juicio).
  prevLine: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  currRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 1 },
  nowWord: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  curr: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
})
