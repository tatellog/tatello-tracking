import { Pressable, StyleSheet, Text, View } from 'react-native'

import { MonthGlanceCalendar } from '@/features/orbit/components/MonthGlanceCalendar'
import type { MonthCalendar } from '@/features/orbit/month-built'
import { colors, typography } from '@/theme'

/*
 * Tu constancia · el calendario (dueña 5 oct 2026: "no parece de Stelar, hazlo
 * como el de Descubre"). Es EL MISMO calendario que Descubre › Mes
 * (MonthGlanceCalendar): oro = déficit, círculo apagado = sobre tu meta, aro
 * frío = comiste poco, aro violeta = entrenaste. Mismo encabezado "‹ Mes ›"
 * con el conteo a la derecha.
 *
 * Arriba, UN dato héroe sin caja (dueña 5 oct 2026: las tres tarjetas hacían
 * ruido): los días entrenados del mes visto en grande, y el descanso en una
 * línea chica SOLO si hubo. Nunca un cero (se lee como deuda); el déficit ya
 * lo dice el calendario en oro.
 */

const REST = colors.dimension.sueno

export function ConstanciaCalendar({
  monthLabel,
  glance,
  trainedDays,
  monthName,
  stats,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onDayPress,
}: {
  monthLabel: string
  /** null = sin meta calórica (el calendario de déficit no tiene con qué juzgar). */
  glance: MonthCalendar | null
  trainedDays: ReadonlySet<string>
  /** "octubre" (minúsculas) para la frase del héroe. */
  monthName: string
  stats: { trained: number; rested: number }
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  onDayPress: (date: string) => void
}) {
  return (
    <View style={styles.wrap}>
      {stats.trained > 0 ? (
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Text style={styles.heroNum}>{stats.trained}</Text>
            <Text style={styles.heroLabel}>
              {`${stats.trained === 1 ? 'día entrenado' : 'días entrenados'} en ${monthName}`}
            </Text>
          </View>
          {stats.rested > 0 ? (
            <View style={styles.restRow}>
              <View style={styles.restDot} />
              <Text style={styles.restText}>{`${stats.rested} de descanso`}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.heroEmpty}>Tu mes empieza con tu primer entreno.</Text>
      )}

      <View style={styles.panel}>
        <View style={styles.pager}>
          <Pressable
            onPress={onBack}
            disabled={!canGoBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
          >
            <Text style={[styles.arrow, !canGoBack && styles.arrowOff]}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle} accessibilityRole="header">
            {monthLabel}
          </Text>
          <Pressable
            onPress={onForward}
            disabled={!canGoForward}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
          >
            <Text style={[styles.arrow, !canGoForward && styles.arrowOff]}>›</Text>
          </Pressable>
          {/* El conteo en la misma fila, como en Descubre. */}
          {glance && glance.dataDays > 0 ? (
            <Text style={[styles.count, glance.dataDays < 5 && styles.countQuiet]}>
              {glance.dataDays < 5
                ? `${glance.dataDays} ${glance.dataDays === 1 ? 'registrado' : 'registrados'}`
                : `${glance.deficitDays} de ${glance.dataDays} en déficit`}
            </Text>
          ) : null}
        </View>

        {glance ? (
          <MonthGlanceCalendar data={glance} onPickDay={onDayPress} trainedDays={trainedDays} />
        ) : (
          <Text style={styles.empty}>
            Define tu meta de calorías para ver tus días en déficit aquí.
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  hero: { paddingHorizontal: 2, gap: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  heroNum: {
    fontFamily: typography.display,
    fontSize: typography.sizes.statHero,
    lineHeight: 52,
    letterSpacing: -1.5,
    color: colors.magenta,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    flexShrink: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 2 },
  restDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: REST },
  restText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  heroEmpty: {
    paddingHorizontal: 2,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.bone,
  },
  // Mismo panel que el calendario de Descubre (glancePanel en MonthSegment).
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  pager: {
    marginTop: 2,
    marginLeft: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthTitle: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.headingLg,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.leche,
  },
  arrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 24,
    color: colors.oroSoft,
  },
  arrowOff: { color: colors.hairline },
  count: {
    marginLeft: 'auto',
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.oroSoft,
    fontVariant: ['tabular-nums'],
  },
  // Con pocos días el conteo no es un logro: sin oro.
  countQuiet: { color: colors.niebla },
  empty: {
    marginTop: 16,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
})
