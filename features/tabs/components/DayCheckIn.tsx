import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import type { CheckInMode } from '../checkin-turn'
import { StarGlyph } from './check-in-glyphs'

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
  /** Lo decide el padre con checkInTurn (puro): ask / answered / quiet. */
  mode: CheckInMode
  /** Un tap dice todo: el tipo elegido responde "entrené" y "de qué". */
  onTrain: (type: WorkoutTypeId) => void
  onRest: () => void
  /** "anotar" (quieta) / "cambiar" (respondida) → abrir la pregunta. */
  onOpen: () => void
  /** "Listo" o respuesta dada → cerrar la pregunta. */
  onClose: () => void
  /** Eyebrow — solo en modo "ver día" (la fecha vista). En Hoy no hay eyebrow:
   *  la pregunta ya dice "hoy" y la tab se llama Hoy. */
  label?: string
  /** La pregunta que los chips responden. */
  question?: string
  /** Día pasado YA entrenado: la estrella está sellada (no retrocede). */
  locked?: boolean
  /** Tipo de entreno del día (manual o del reloj). */
  workoutType?: string | null
  /** La mutación optimista falló e hizo rollback: línea cálida de reintento
   *  en vez de apagar la estrella en silencio. */
  saveFailed?: boolean
  /** V-15 Smart Recovery: el reloj ya selló el entreno de hoy (sin registro
   *  manual encima). La fila nace confirmada (con sus minutos) y "cambiar"
   *  solo abre el tipo: el dato del dispositivo manda, nunca se des-entrena
   *  contra él. La procedencia la dice la firma de Hoy, no esta fila. */
  wearable?: { minutes: number | null; kcal: number | null } | null
}

// Star = a trained day (the constellation's glyph). Vive SOLO en la fila
// confirmada: en los chips daría más peso a "entrené" y susurraría que es la
// respuesta buena. La estrella se gana, no se promete. (check-in-glyphs.tsx)

// Una sola curva de layout para el bloque: los estados se funden en vez de
// cortarse, y la constelación de abajo se desliza en lugar de brincar.
const LAYOUT = LinearTransition.duration(220)

// Cuánto se queda visible el chip recién elegido antes de recogerse: sin
// este hold, el bloque colapsaba en el frame siguiente y la usuaria nunca
// veía su chip pintarse de magenta.
const CHIP_HOLD_MS = 450

type ChipProps = {
  label: string
  active: boolean
  onPress: () => void
  a11y: string
  style?: object
}

// Receta "control" (dirección de arte sep 2026): píldora fantasma, sin fill,
// borde hairlineStrong; el estado activo solo cambia borde y texto a magenta.
function Chip({ label, active, onPress, a11y, style }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={[styles.chip, active && styles.chipActive, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={a11y}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

/**
 * The daily check-in. "Un tap dice todo" (decisión dueña sep 2026): la
 * pregunta "¿Entrenaste hoy?" se responde con el tipo (Fuerza · Cardio ·
 * Caminata · Otro) o con "Fue descanso" en su propia línea, misma píldora.
 * Un tap responde entreno Y tipo, y la estrella se enciende en ese tap.
 *
 * Tres modos (checkInTurn):
 *   - ask → pregunta en voz coach + chips (o, ya respondido, el modo se
 *     DECLARA "Cambiando tu respuesta · Listo"),
 *   - answered → fila colapsada "✦ Entrenaste hoy · Fuerza · cambiar",
 *   - quiet → línea "Entreno o descanso · anotar" (puerta, no pregunta).
 * En edición, tocar la respuesta activa CONFIRMA y cierra, no borra.
 * Ambas respuestas son válidas: ninguna se lee como fallo.
 */
export function DayCheckIn({
  state,
  mode,
  onTrain,
  onRest,
  onOpen,
  onClose,
  label,
  question = '¿Entrenaste hoy?',
  locked = false,
  workoutType,
  saveFailed = false,
  wearable = null,
}: Props) {
  // El chip recién tocado: sostiene el bloque abierto CHIP_HOLD_MS para que
  // la selección se vea antes del colapso (fill → hold → recogida).
  const [justPicked, setJustPicked] = useState<WorkoutTypeId | 'rested' | null>(null)
  // En EDICIÓN los chips eligen en borrador: nada se guarda hasta "Listo", y
  // "Cancelar" descarta. En el flujo fresco un tap anota de inmediato.
  const [draft, setDraft] = useState<WorkoutTypeId | 'rested' | null>(null)
  const answered = state !== 'undecided'
  // Sellado por el reloj: "Fue descanso" no aparece ni en edición; lo único
  // editable es el tipo.
  const sealedByWearable = wearable != null && state === 'trained'
  const isHoy = label == null
  const typeLabel = WORKOUT_TYPES.find((t) => t.id === workoutType)?.label ?? null

  // Accesibilidad: con "reducir movimiento" activo los estados cambian en
  // seco, sin fundidos ni transiciones de layout (igual que el Lottie de Hoy).
  const reducedMotion = useReducedMotion()
  const layout = reducedMotion ? undefined : LAYOUT
  const fadeIn = reducedMotion ? undefined : FadeIn.duration(180)
  const fadeInSlow = reducedMotion ? undefined : FadeIn.duration(220)
  const fadeOut = reducedMotion ? undefined : FadeOut.duration(120)

  useEffect(() => {
    if (justPicked === null) return
    if (reducedMotion) {
      setJustPicked(null)
      onClose()
      return
    }
    const t = setTimeout(() => {
      setJustPicked(null)
      onClose()
    }, CHIP_HOLD_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justPicked, reducedMotion])

  const editing = answered && !locked
  const current: WorkoutTypeId | 'rested' | null =
    state === 'rested'
      ? 'rested'
      : state === 'trained'
        ? ((workoutType as WorkoutTypeId) ?? null)
        : null
  const shown = justPicked ?? (editing ? (draft ?? current) : null)
  const activeType = shown === 'rested' ? null : shown
  const restActive = shown === 'rested'

  const pickType = (type: WorkoutTypeId) => {
    if (locked) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (editing) {
      setDraft(type)
      return
    }
    onTrain(type)
    setJustPicked(type)
  }

  const pickRest = () => {
    if (locked) return
    Haptics.selectionAsync().catch(() => {})
    if (editing) {
      setDraft('rested')
      return
    }
    onRest()
    setJustPicked('rested')
  }

  // "Listo" guarda el borrador si cambió; "Cancelar" lo descarta. Ambos cierran.
  const commitEdit = () => {
    const next = draft
    setDraft(null)
    if (next != null && next !== current) {
      if (next === 'rested') onRest()
      else onTrain(next)
    }
    onClose()
  }
  const cancelEdit = () => {
    setDraft(null)
    onClose()
  }

  // Mientras el chip recién elegido se sostiene, el bloque sigue abierto
  // aunque el padre ya lo dé por respondido.
  const showAsk = !locked && (mode === 'ask' || justPicked !== null)
  const showQuiet = !locked && !showAsk && mode === 'quiet' && !answered

  return (
    <Animated.View layout={layout} style={styles.wrap}>
      {label ? <Text style={styles.eyebrow}>{label}</Text> : null}

      {showQuiet ? (
        <Animated.View layout={layout} entering={fadeIn} exiting={fadeOut}>
          <Pressable
            onPress={onOpen}
            hitSlop={{ top: 10, bottom: 10 }}
            accessibilityRole="button"
            accessibilityLabel={
              isHoy
                ? 'Anotar tu entreno o descanso de hoy'
                : 'Anotar el entreno o descanso de ese día'
            }
            style={({ pressed }) => [styles.quietRow, pressed && styles.pressed]}
          >
            <Text style={styles.quietText}>
              Entreno o descanso
              <Text style={styles.changeLink}> · anotar</Text>
            </Text>
          </Pressable>
        </Animated.View>
      ) : showAsk ? (
        <Animated.View layout={layout} entering={fadeIn} exiting={fadeOut}>
          {/* Flujo fresco: la pregunta coach. En edición: el modo se DECLARA
              (sin lead se veía idéntico a "te pregunto de nuevo") y tiene
              puerta explícita "Listo" que cierra sin mutar nada. */}
          {!answered ? (
            <Text style={styles.question}>{question}</Text>
          ) : (
            <View style={styles.editHeader}>
              <Text style={styles.editLead}>
                {sealedByWearable ? '¿De qué tipo fue tu entreno?' : 'Cambiando tu respuesta'}
              </Text>
              <View style={styles.editDoors}>
                <Pressable
                  onPress={cancelEdit}
                  hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar, cerrar sin cambiar"
                >
                  <Text style={styles.changeLink}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={commitEdit}
                  hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Listo, guardar y cerrar"
                >
                  <Text style={styles.doneLink}>Listo</Text>
                </Pressable>
              </View>
            </View>
          )}
          {/* Los tipos arriba (un tap = entrené + de qué) y "Fue descanso" en
              su propia línea con la MISMA píldora: la otra respuesta a la
              pregunta, nunca un quinto chip perdido ni un "no". */}
          <View style={styles.typeRow}>
            {WORKOUT_TYPES.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                active={activeType === t.id}
                onPress={() => pickType(t.id)}
                a11y={`Entrené hoy, ${t.label.toLowerCase()}`}
                style={styles.typeChip}
              />
            ))}
          </View>
          {/* Ajustando lo que trajo el reloj: se nombra el dato y se deja elegir. */}
          {sealedByWearable ? (
            <Text style={styles.hint}>
              {wearable?.minutes != null
                ? `Tu smartwatch anotó ${wearable.minutes} min · elige el tipo si fue distinto`
                : 'Tu smartwatch anotó tu entreno · elige el tipo si fue distinto'}
            </Text>
          ) : (
            <View style={styles.restRow}>
              <Chip
                label="Fue descanso"
                active={restActive}
                onPress={pickRest}
                a11y={
                  restActive
                    ? 'Fue descanso. Tu respuesta actual, toca para confirmar'
                    : 'Fue descanso'
                }
                style={styles.restChip}
              />
            </View>
          )}
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
            {/* Lo que el reloj trajo, como contexto (spec wearables §3): la
                quema nunca infla el presupuesto de comida ni entra al TDEE. */}
            {sealedByWearable && wearable?.minutes != null ? (
              <Text style={styles.confirmedType}>{` · ${wearable.minutes} min`}</Text>
            ) : null}
            {sealedByWearable && wearable?.kcal != null ? (
              <Text style={styles.confirmedType}>{` · ~${wearable.kcal} kcal`}</Text>
            ) : null}
          </Text>
          {!locked && !sealedByWearable ? (
            <Pressable
              onPress={onOpen}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Cambiar tu respuesta de este día"
            >
              <Text style={styles.changeLink}>cambiar</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      )}

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
      ) : state === 'rested' && !showAsk ? (
        <Animated.Text
          layout={layout}
          entering={fadeInSlow}
          exiting={fadeOut}
          style={styles.restMessage}
        >
          Descansar también cuenta. Mañana <Text style={styles.restEm}>sigues</Text>.
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
    marginBottom: 0,
  },
  pressed: { opacity: 0.8 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
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
  // Las dos puertas de la edición: Cancelar (niebla) · Listo (bone, la que guarda).
  editDoors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  doneLink: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  // Voz coach — la pregunta que los chips responden.
  question: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    marginBottom: 10,
    marginLeft: 2,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // "Fue descanso" debajo, misma píldora, a su propio ancho.
  restRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  typeChip: {
    flex: 1,
    paddingHorizontal: 6,
  },
  restChip: {
    paddingHorizontal: 18,
  },
  chipActive: {
    borderColor: colors.magenta,
  },
  chipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: colors.magenta,
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
  hint: {
    marginTop: 8,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  changeLink: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  // Línea quieta — no pregunta, solo deja la puerta abierta.
  quietRow: {
    paddingVertical: 8,
    marginLeft: 2,
  },
  quietText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.niebla,
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
