import { Pressable, StyleSheet, Text, View } from 'react-native'

import { emitRegistroIntent, type MealMoment } from '@/features/macros/registro-intent'
import { colors, typography } from '@/theme'

import { MomentStar } from './MomentStar'

const MOMENTS: { type: MealMoment; label: string }[] = [
  { type: 'breakfast', label: 'Desayuno' },
  { type: 'lunch', label: 'Comida' },
  { type: 'dinner', label: 'Cena' },
  { type: 'snack', label: 'Snack' },
]

// Frase REAL (no poética) por momento pendiente — nombra el momento concreto.
const PENDING_LINE: Record<MealMoment, string> = {
  breakfast: 'El desayuno aún no está registrado.',
  lunch: 'La comida aún no está registrada.',
  dinner: 'La cena aún no está registrada.',
  snack: 'El snack aún no está registrado.',
}

/** El momento que "toca" por hora — para nombrar el pendiente más relevante. */
function momentByHour(): MealMoment {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

type Props = {
  /** Comidas del día visto (cada una con su meal_type). */
  meals: readonly { meal_type: string }[]
  /** En "modo ver día" la sección es lectura: nada se registra desde el pasado. */
  viewingPast: boolean
}

/*
 * "HOY" — los momentos del día como estrellas que se encienden al registrar.
 * El lado PRÁCTICO del Tab Comidas (qué me falta capturar), frente al hero
 * EMOCIONAL (la luna). Contextual + accionable: tocar un momento pendiente
 * abre el registro con ese tipo preseleccionado.
 */
export function MomentsToday({ meals, viewingPast }: Props) {
  const registered = new Set(meals.map((m) => m.meal_type))
  const litCount = MOMENTS.filter((m) => registered.has(m.type)).length
  const allLit = litCount === MOMENTS.length

  // Línea contextual: el momento concreto que sigue (por hora si está
  // pendiente, si no el primer pendiente). Sin culpa, real.
  let context: string
  let contextTone: 'normal' | 'complete' = 'normal'
  if (viewingPast) {
    context = `${litCount} de 4 momentos registrados`
  } else if (litCount === 0) {
    context = 'Aún no registras nada hoy.'
  } else if (allLit) {
    context = 'Registraste cada momento de hoy.'
    contextTone = 'complete'
  } else {
    const byHour = momentByHour()
    const target = !registered.has(byHour)
      ? byHour
      : (MOMENTS.find((m) => !registered.has(m.type))?.type ?? byHour)
    context = PENDING_LINE[target]
  }

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Hoy</Text>

      <View style={styles.row}>
        {/* Hairline de constelación — convierte 4 puntos en un cielo, no en
            un checklist. Corre por el centro de las estrellas, detrás. */}
        <View style={styles.connector} pointerEvents="none" />

        {MOMENTS.map((m) => {
          const lit = registered.has(m.type)
          const tappable = !viewingPast && !lit
          const inner = (
            <>
              <MomentStar lit={lit} />
              <Text style={[styles.label, lit ? styles.labelLit : styles.labelOff]}>{m.label}</Text>
            </>
          )
          return tappable ? (
            <Pressable
              key={m.type}
              style={styles.chip}
              onPress={() => emitRegistroIntent(m.type)}
              accessibilityRole="button"
              accessibilityLabel={`${m.label}, sin registrar, toca para registrar`}
            >
              {inner}
            </Pressable>
          ) : (
            <View
              key={m.type}
              style={styles.chip}
              accessibilityLabel={`${m.label}, ${lit ? 'registrado' : 'sin registro'}`}
            >
              {inner}
            </View>
          )
        })}
      </View>

      <Text style={[styles.context, contextTone === 'complete' && styles.contextComplete]}>
        {context}
      </Text>
      {/* El conteo honesto que pediste — como nota al pie callada (no score). */}
      {!viewingPast && litCount > 0 && !allLit ? (
        <Text style={styles.count}>{litCount} de 4 momentos registrados</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 6,
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    position: 'relative',
  },
  // Backbone de constelación entre las 4 estrellas (centros a 1/8 y 7/8).
  connector: {
    position: 'absolute',
    top: 11,
    left: '12.5%',
    right: '12.5%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.oro,
    opacity: 0.2,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 2,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 0.3,
  },
  labelLit: {
    color: colors.bone,
  },
  labelOff: {
    color: colors.niebla,
  },
  // Línea contextual — práctica, upright (no italic: no es voz de coach).
  context: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.2,
    color: colors.bone,
  },
  contextComplete: {
    color: colors.oroLight,
  },
  count: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
})
