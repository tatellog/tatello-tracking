import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { describeWeightChange, weighInsForTrend, type WeightPoint } from '../logic'
import { CountUp } from './CountUp'
import { DropGlyph, ProgressRing, ScaleGlyph, TargetGlyph } from './HealthGlyphs'
import { WeightChart, fmtShortDay } from './WeightChart'

/*
 * Peso en Progreso, al estilo Salud/Fitness (dueña 7 oct 2026: "lo más limpio y
 * entendible posible"). Una tarjeta: tu último peso con su fecha, cuánto cambió
 * y desde cuándo, la gráfica de tus mediciones. Debajo, el ciclo (si mueve la
 * báscula) y tus días en déficit, para unir el peso con lo que comes. Nada de
 * frases: cada número dice de cuándo es y con cuántos datos.
 */

export type WeightPeriod = 'W' | 'M' | 'H' | 'Y'
export const WEIGHT_PERIODS: { key: WeightPeriod; label: string; a11y: string; days: number }[] = [
  { key: 'W', label: 'S', a11y: 'Semana', days: 7 },
  { key: 'M', label: 'M', a11y: 'Mes', days: 30 },
  { key: 'H', label: '6M', a11y: '6 meses', days: 182 },
  { key: 'Y', label: 'A', a11y: 'Año', days: 365 },
]

export function WeightCard({
  points,
  latest,
  period,
  onPeriod,
  onOpenAll,
  cycle,
  deficit,
}: {
  /** Mediciones crudas dentro del periodo. */
  points: readonly WeightPoint[]
  /** La medición más reciente de toda la historia (el número grande). */
  latest: WeightPoint
  period: WeightPeriod
  onPeriod: (p: WeightPeriod) => void
  onOpenAll: () => void
  /** El ciclo cuando mueve la báscula (lútea / menstrual), o null. */
  cycle: { day: number; note: string } | null
  /** Días en déficit de los últimos 30 días con comida, o null. */
  deficit: { days: number; of: number } | null
}) {
  const change = describeWeightChange(points)
  const need = weighInsForTrend(points.length)
  const arrow = change ? (change.abs > 0 ? '↑' : change.abs < 0 ? '↓' : '=') : null

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
        <CardHeader
          icon={<ScaleGlyph color={colors.magenta} />}
          title="Peso"
          color={colors.magenta}
          right={fmtShortDay(latest.t)}
        />

        <View style={styles.numbers}>
          <View style={styles.valueRow}>
            <CountUp value={latest.weight} decimals={1} style={styles.value} />
            <Text style={styles.unit}>kg</Text>
          </View>
          {change && arrow ? (
            <View style={styles.changeCol}>
              <Text style={styles.change}>{`${arrow} ${Math.abs(change.abs).toFixed(1)} kg`}</Text>
              <Text style={styles.caption}>{`desde el ${fmtShortDay(change.fromT)}`}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.periods}>
          {WEIGHT_PERIODS.map((p) => {
            const on = p.key === period
            return (
              <Pressable
                key={p.key}
                onPress={() => onPeriod(p.key)}
                accessibilityRole="button"
                accessibilityLabel={p.a11y}
                accessibilityState={{ selected: on }}
                style={[styles.periodSeg, on && styles.periodSegOn]}
              >
                <Text style={[styles.periodText, on && styles.periodTextOn]}>{p.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {points.length > 0 ? (
          <WeightChart points={points} />
        ) : (
          <Text style={styles.emptyRange}>Sin mediciones en este periodo.</Text>
        )}

        {need > 0 && points.length > 0 ? (
          <Text style={styles.hint}>
            {`${points.length} ${points.length === 1 ? 'medición' : 'mediciones'}. Pésate ${need} ${need === 1 ? 'vez' : 'veces'} más para ver tu tendencia.`}
          </Text>
        ) : change ? (
          <Text style={styles.caption}>
            {`${change.n} mediciones · el cambio compara tu promedio de 7 días`}
          </Text>
        ) : null}
      </Animated.View>

      {cycle ? (
        <Animated.View entering={FadeIn.duration(320).delay(120)} style={styles.card}>
          <CardHeader
            icon={<DropGlyph color={colors.oroSoft} />}
            title="Ciclo"
            color={colors.oroSoft}
            right={`Día ${cycle.day}`}
          />
          <Text style={styles.rowText}>{cycle.note}</Text>
        </Animated.View>
      ) : null}

      {deficit ? (
        <Animated.View entering={FadeIn.duration(320).delay(200)} style={styles.card}>
          <CardHeader
            icon={<TargetGlyph color={colors.magenta} />}
            title="Déficit"
            color={colors.magenta}
            right="Últimos 30 días"
          />
          <View style={styles.deficitBody}>
            <View style={styles.deficitText}>
              <View style={styles.valueRow}>
                <CountUp value={deficit.days} style={styles.deficitValue} />
                <Text style={styles.deficitOf}>{`de ${deficit.of} días`}</Text>
              </View>
              <Text style={styles.caption}>días con comida que quedaron en déficit</Text>
            </View>
            <ProgressRing
              pct={deficit.of > 0 ? deficit.days / deficit.of : 0}
              color={colors.magenta}
              track={colors.magentaTint2}
            />
          </View>
        </Animated.View>
      ) : null}

      <Pressable
        onPress={onOpenAll}
        accessibilityRole="button"
        style={({ pressed }) => [styles.rowCard, styles.linkRow, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>Mostrar todos los datos</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  )
}

/** El encabezado de cada tarjeta, igual en todas (como Salud): ícono animado,
 *  título en el color de su categoría y un dato a la derecha. */
function CardHeader({
  icon,
  title,
  color,
  right,
}: {
  icon: React.ReactNode
  title: string
  color: string
  right?: string
}) {
  return (
    <View style={styles.head}>
      <View style={styles.headTitle}>
        {icon}
        <Text style={[styles.title, { color }]}>{title}</Text>
      </View>
      {right ? <Text style={styles.headDate}>{right}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { borderRadius: 20, backgroundColor: colors.bgCard, padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontFamily: typography.uiBold, fontSize: typography.sizes.body },
  headDate: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  numbers: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  value: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.statHero,
    lineHeight: 50,
    letterSpacing: -1.5,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: typography.uiBold, fontSize: typography.sizes.bodyLarge, color: colors.bone },
  changeCol: { alignItems: 'flex-end', gap: 1 },
  change: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  periods: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: 10,
    backgroundColor: colors.bgCard2,
  },
  periodSeg: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSegOn: { backgroundColor: colors.magentaTint2 },
  periodText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  periodTextOn: { fontFamily: typography.uiBold, color: colors.leche },
  emptyRange: {
    paddingVertical: 40,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  hint: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.leche,
  },
  deficitBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deficitText: { gap: 2, flexShrink: 1 },
  deficitValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.macroNum,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  deficitOf: { fontSize: typography.sizes.bodyLarge, color: colors.niebla },
  linkRow: { justifyContent: 'space-between' },
  linkText: { fontFamily: typography.uiSemi, fontSize: typography.sizes.body, color: colors.leche },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
  pressed: { opacity: 0.7 },
})
