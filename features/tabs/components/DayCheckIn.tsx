import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

export type DayState = 'undecided' | 'trained' | 'rested'

/** Catálogo de tipos de entreno. Describe (para el motor de patrones), no
 *  prescribe: el id se persiste en workouts.type, fluye a
 *  daily_signals.workout_type y lo consume _shared/intelligence/workout-type
 *  (mezcla en la constancia de Movimiento + patrón tipo×déficit en Mes). */
export const WORKOUT_TYPES = [
  { id: 'fuerza', label: 'Fuerza' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'caminata', label: 'Caminata' },
  { id: 'otro', label: 'Otro' },
] as const

export type WorkoutTypeId = (typeof WORKOUT_TYPES)[number]['id']

type Props = {
  state: DayState
  /** Next state — the parent maps it to the workout/rest mutations. */
  onChange: (next: DayState) => void
  /** Eyebrow — "Hoy" por defecto; en modo "ver día" se pasa la fecha vista. */
  label?: string
  /** La pregunta que las cápsulas responden. Sin ella los botones se leían
   *  como tabs/filtros (feedback beta): la pregunta convierte "Entrené" y
   *  "Fue descanso" en respuestas. */
  question?: string
  /** Día pasado YA entrenado: la estrella está sellada (no retrocede). */
  locked?: boolean
  /** Tipo de entreno del día. Con onWorkoutType presente, al confirmar
   *  "Entrené" aparecen chips opcionales (progressive disclosure, skippable). */
  workoutType?: string | null
  onWorkoutType?: (type: WorkoutTypeId | null) => void
  /** La mutación optimista falló e hizo rollback: línea cálida de reintento
   *  en vez de apagar la estrella en silencio. */
  saveFailed?: boolean
}

// Star = a trained day (the constellation's glyph). Vive SOLO en la fila
// confirmada — en las cápsulas de respuesta daba más peso visual a "Entrené"
// y susurraba que era la respuesta buena. La estrella se gana, no se promete.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

function StarGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  )
}

// Una sola curva de layout para el bloque: los estados se funden en vez de
// cortarse, y la constelación de abajo se desliza en lugar de brincar.
const LAYOUT = LinearTransition.duration(220)

// Cuánto se queda visible el chip recién elegido antes de recogerse — sin
// este hold, el bloque colapsaba en el frame siguiente y la usuaria nunca
// veía su chip pintarse de magenta.
const CHIP_HOLD_MS = 450

type AnswerProps = {
  label: string
  active: boolean
  onPress: () => void
}

function Answer({ label, active, onPress }: AnswerProps) {
  const tint = active ? colors.magenta : colors.niebla
  return (
    <Pressable
      onPress={onPress}
      // Press-down tick only — the anticipation beat. The reward fires from
      // the Hoy screen's handleDayChange once the state actually commits.
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      style={[styles.answer, active && styles.answerActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? `${label}. Tu respuesta actual, toca para confirmar` : label}
    >
      <Text style={[styles.answerText, { color: tint }]}>{label}</Text>
    </Pressable>
  )
}

/**
 * The daily check-in. Tres estados:
 *   - undecided → pregunta en voz coach + dos cápsulas separadas (dos
 *     botones = dos acciones; la píldora segmentada se leía como filtro),
 *   - respondido → fila colapsada "✦ Entrenaste hoy · cambiar",
 *   - locked → día pasado sellado, solo lectura.
 * En edición ("cambiar"), tocar la respuesta activa CONFIRMA y cierra — no
 * borra (el gesto natural de "sí, esto" era pérdida de datos). Cambiar de
 * respuesta sigue siendo un tap sobre la otra cápsula.
 * Ambas respuestas son válidas — ninguna se lee como fallo.
 */
export function DayCheckIn({
  state,
  onChange,
  label = 'Hoy',
  question = '¿Entrenaste hoy?',
  locked = false,
  workoutType,
  onWorkoutType,
  saveFailed = false,
}: Props) {
  const [editing, setEditing] = useState(false)
  // El chip recién tocado — sostiene el bloque abierto CHIP_HOLD_MS para que
  // la selección se vea antes del colapso (fill → hold → recogida).
  const [justPicked, setJustPicked] = useState<WorkoutTypeId | null>(null)
  const answered = state !== 'undecided'
  const showAnswers = !locked && (!answered || editing)
  const isHoy = label === 'Hoy'
  const typeLabel = WORKOUT_TYPES.find((t) => t.id === workoutType)?.label ?? null

  // Accesibilidad: con "reducir movimiento" activo los estados cambian en
  // seco, sin fundidos ni transiciones de layout (igual que el Lottie de Hoy).
  const reducedMotion = useReducedMotion()
  const layout = reducedMotion ? undefined : LAYOUT
  const fadeIn = reducedMotion ? undefined : FadeIn.duration(180)
  const fadeInSlow = reducedMotion ? undefined : FadeIn.duration(220)
  const fadeOut = reducedMotion ? undefined : FadeOut.duration(120)
  const chipsEnter = reducedMotion
    ? undefined
    : editing
      ? FadeIn.duration(180)
      : FadeIn.delay(900).duration(250)
  const chipsExit = reducedMotion ? undefined : FadeOut.duration(140)

  useEffect(() => {
    if (justPicked === null) return
    const t = setTimeout(() => setJustPicked(null), CHIP_HOLD_MS)
    return () => clearTimeout(t)
  }, [justPicked])

  const pick = (seg: 'trained' | 'rested') => {
    if (locked) return
    if (state === seg) {
      // Tap sobre la respuesta activa = confirmar y salir de edición.
      setEditing(false)
      return
    }
    onChange(seg)
    setEditing(false)
  }

  const showChips =
    state === 'trained' &&
    !locked &&
    !!onWorkoutType &&
    (editing || !typeLabel || justPicked !== null)

  return (
    <Animated.View layout={layout} style={styles.wrap}>
      <Text style={styles.eyebrow}>{label}</Text>

      {showAnswers ? (
        <Animated.View layout={layout} entering={fadeIn} exiting={fadeOut}>
          {/* Flujo fresco: la pregunta coach. En edición: el modo se DECLARA
              (sin lead se veía idéntico a "te pregunto de nuevo") y tiene
              puerta explícita "Listo" que cierra sin mutar nada (feedback
              usuaria: "busco un listo o una X y no hay"). */}
          {!answered ? (
            <Text style={styles.question}>{question}</Text>
          ) : (
            <View style={styles.editHeader}>
              <Text style={styles.editLead}>Cambiando tu respuesta</Text>
              <Pressable
                onPress={() => setEditing(false)}
                hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Listo, cerrar edición"
              >
                <Text style={styles.changeLink}>Listo</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.answers}>
            <Answer label="Entrené" active={state === 'trained'} onPress={() => pick('trained')} />
            <Answer
              label="Fue descanso"
              active={state === 'rested'}
              onPress={() => pick('rested')}
            />
          </View>
        </Animated.View>
      ) : (
        <Animated.View
          layout={layout}
          entering={fadeInSlow}
          exiting={fadeOut}
          style={styles.confirmedRow}
        >
          {state === 'trained' ? <StarGlyph color={colors.magenta} /> : null}
          <Text style={styles.confirmedText}>
            {state === 'trained'
              ? isHoy
                ? 'Entrenaste hoy'
                : 'Entrenaste este día'
              : isHoy
                ? 'Hoy fue descanso'
                : 'Este día fue descanso'}
            {state === 'trained' && typeLabel ? (
              <Text style={styles.confirmedType}>{` · ${typeLabel}`}</Text>
            ) : null}
          </Text>
          {!locked ? (
            <Pressable
              onPress={() => setEditing(true)}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Cambiar tu respuesta de este día"
            >
              <Text style={styles.changeLink}>cambiar</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      )}

      {/* Chips de tipo — solo tras confirmar entreno, siempre opcionales (la
          opcionalidad se comunica dejando pasar, no con etiqueta). Entran con
          delay tras "Entrené" para no compartir beat con la celebración; una
          vez elegido el tipo se recogen (la respuesta sube a la fila). */}
      {showChips ? (
        <Animated.View
          layout={layout}
          entering={chipsEnter}
          exiting={chipsExit}
          style={styles.typeBlock}
        >
          {/* En edición los chips quedan bajo "Fue descanso" y el lead corto
              se leía "¿de qué tipo de descanso?" — nombrar el sujeto. */}
          <Text style={styles.typeLead}>
            {editing ? '¿De qué tipo fue tu entreno?' : '¿De qué tipo?'}
          </Text>
          <View style={styles.typeRow}>
            {WORKOUT_TYPES.map((t) => {
              const active = workoutType === t.id || justPicked === t.id
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                    if (active) {
                      // Afirmación, no borrado (patrón Apple de selección
                      // única): tocar lo prendido = "sí, esto" y cierra.
                      // El mismo gesto borraba el tipo en silencio — la
                      // trampa exacta que reportó la usuaria.
                      setEditing(false)
                      return
                    }
                    onWorkoutType?.(t.id)
                    setJustPicked(t.id)
                    setEditing(false)
                  }}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Tipo de entreno: ${t.label}`}
                >
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Animated.View>
      ) : null}

      {/* Sellado — un entreno pasado ya encendió su estrella y no retrocede. */}
      {locked ? (
        <Animated.Text
          layout={layout}
          entering={fadeInSlow}
          exiting={fadeOut}
          style={styles.sealedMessage}
        >
          Esta estrella ya está <Text style={styles.restEm}>encendida</Text>. Lo que enciendes,
          permanece.
        </Animated.Text>
      ) : state === 'rested' && !editing ? (
        <Animated.Text
          layout={layout}
          entering={fadeInSlow}
          exiting={fadeOut}
          style={styles.restMessage}
        >
          El músculo se reconstruye en el reposo. Mañana vuelves{' '}
          <Text style={styles.restEm}>más fuerte</Text>.
        </Animated.Text>
      ) : null}

      {saveFailed ? (
        <Animated.Text layout={layout} entering={fadeIn} exiting={fadeOut} style={styles.errorLine}>
          No pudimos guardarlo. Toca de nuevo cuando tengas señal.
        </Animated.Text>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  // Modo edición declarado — capa meta de UI (Hanken upright, no coach).
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginLeft: 2,
  },
  editLead: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  // Voz coach — la pregunta que el control responde.
  question: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    marginBottom: 10,
    marginLeft: 2,
  },
  // Dos cápsulas separadas (gap visible, borde propio) — dos acciones.
  answers: {
    flexDirection: 'row',
    gap: 10,
  },
  answer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard2,
  },
  answerActive: {
    backgroundColor: colors.magentaTint2,
  },
  answerText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
  },
  // Estado respondido — colapsado, con el deshacer como affordance visible.
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginLeft: 2,
  },
  confirmedText: {
    flex: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.leche,
  },
  // El tipo elegido, integrado a la fila ("Entrenaste hoy · Fuerza").
  confirmedType: {
    fontFamily: typography.uiSemi,
    color: colors.bone,
  },
  changeLink: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  typeBlock: {
    marginTop: 12,
    marginLeft: 2,
  },
  // Capa meta unificada a 12.5 — en niebla 11.5 el lead se leía apretado.
  typeLead: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard2,
  },
  typeChipActive: {
    backgroundColor: colors.magentaTint2,
  },
  typeChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  typeChipTextActive: {
    color: colors.magenta,
  },
  // Editorial voice — serif italic, evidence not guilt.
  restMessage: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 20,
    color: colors.bone,
    marginTop: 10,
    marginLeft: 2,
  },
  sealedMessage: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginTop: 10,
    marginLeft: 2,
  },
  restEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
  // La única línea que la usuaria NECESITA ver — bone, no niebla, para que
  // no se confunda con la letra chica decorativa.
  errorLine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    marginTop: 10,
    marginLeft: 2,
  },
})
