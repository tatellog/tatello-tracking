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

import { useSleepLog, useUpsertSleep } from '@/features/sleep/hooks'
import { formatSleepShort } from '@/features/wearables/recovery'
import { colors, typography } from '@/theme'

import type { CheckInMode } from '../checkin-turn'
import { nearestSleepChip, SLEEP_CHIPS, sleepAnsweredText } from '../sleep-question'

/*
 * La pregunta de sueño de Hoy — "¿Cuánto dormiste anoche?". Tercer beat del
 * check-in (entreno → tipo → sueño), con la MISMA gramática que los chips de
 * tipo: pregunta en voz coach + píldoras fantasma + un tap anota y colapsa.
 * Nada de instrumento: el motor lee el sueño por umbrales de media hora, así
 * que siete chips bastan. La calidad ya no se escribe (era una calificación
 * derivada de las horas: la app afirmaba lo que no sabe).
 *
 * El modo lo decide el padre con checkInTurn (puro): ask / answered /
 * quiet. Anotado, la fila colapsada "☾ Dormiste 7 h 30 · cambiar" es
 * idéntica a la de entreno.
 */
type Props = {
  date: string
  mode: CheckInMode
  /** Minutos de sueño que trajo el reloj SIN registro manual (null si nada). */
  wearableMinutes?: number | null
  /** "cambiar" / "anotar" → abrir el control. */
  onOpen: () => void
  /** "Listo" / chip elegido (touched=true) o "Después" (false) → cerrar. */
  onClose: (touched: boolean) => void
  /** Modo "ver día": la línea dice "esa noche", no "anoche". */
  past?: boolean
}

// A crescent — same moon glyph as the dinner meal slot.
const MOON = 'M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z'

const LAYOUT = LinearTransition.duration(220)

// Cuánto se queda visible el chip recién elegido antes de colapsar (mismo
// hold que los chips de tipo): sin él, la usuaria nunca ve su chip en magenta.
const CHIP_HOLD_MS = 450

export function SleepCheckIn({
  date,
  mode,
  wearableMinutes = null,
  onOpen,
  onClose,
  past = false,
}: Props) {
  const { data: log } = useSleepLog(date)
  const upsert = useUpsertSleep(date)
  // Lo recién elegido, hasta que la query traiga la fila (así la línea
  // colapsada nunca muestra un dato viejo tras el tap).
  const [picked, setPicked] = useState<number | null>(null)
  const [justPicked, setJustPicked] = useState<number | null>(null)

  const reducedMotion = useReducedMotion()
  const layout = reducedMotion ? undefined : LAYOUT
  const fadeIn = reducedMotion ? undefined : FadeIn.duration(180)
  const fadeOut = reducedMotion ? undefined : FadeOut.duration(120)

  const manualMinutes = picked ?? log?.duration_minutes ?? null
  // V-15: sin fila manual, la noche del reloj vale como anotada (con su
  // procedencia). Tocar un chip escribe manual → manual gana.
  const fromWatch = manualMinutes == null && wearableMinutes != null
  const minutes = manualMinutes ?? wearableMinutes
  const hasEntry = minutes != null
  const activeChip = justPicked ?? (hasEntry ? nearestSleepChip(minutes)?.minutes : null)

  // Tras elegir, sostener el chip en magenta y colapsar (en seco con reduce
  // motion, igual que DayCheckIn).
  useEffect(() => {
    if (justPicked === null) return
    if (reducedMotion) {
      setJustPicked(null)
      onClose(true)
      return
    }
    const t = setTimeout(() => {
      setJustPicked(null)
      onClose(true)
    }, CHIP_HOLD_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justPicked, reducedMotion])

  const pick = (chipMinutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (chipMinutes === activeChip && hasEntry && justPicked === null) {
      // Afirmación, no borrado (regla de los chips de tipo): tocar lo prendido
      // = "sí, esto" y cierra sin escribir de nuevo.
      onClose(true)
      return
    }
    setPicked(chipMinutes)
    setJustPicked(chipMinutes)
    upsert.mutate({ durationMinutes: chipMinutes, quality: null })
  }

  // ── Línea quieta: pospuesta ("Después") o día pasado sin anotar. ──
  if (mode === 'quiet') {
    return (
      <Animated.View layout={layout} entering={fadeIn} exiting={fadeOut}>
        <Pressable
          onPress={onOpen}
          hitSlop={{ top: 10, bottom: 10 }}
          accessibilityRole="button"
          accessibilityLabel={past ? 'Anotar el sueño de esa noche' : 'Anotar el sueño de anoche'}
          style={({ pressed }) => [styles.quietRow, pressed && styles.pressed]}
        >
          <Text style={styles.quietText}>
            {past ? 'Sueño de esa noche' : 'Sueño de anoche'}
            <Text style={styles.link}> · anotar</Text>
          </Text>
        </Pressable>
      </Animated.View>
    )
  }

  // ── Respondida: una fila, como el check-in de entreno. ──
  if (mode === 'answered' && minutes != null) {
    return (
      <Animated.View
        layout={layout}
        entering={fadeIn}
        exiting={fadeOut}
        style={styles.confirmedRow}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d={MOON} fill={colors.magenta} />
        </Svg>
        <Text style={styles.confirmedText}>
          {sleepAnsweredText(minutes, { manual: !fromWatch, past })}
          {fromWatch ? <Text style={styles.provenance}>{'\ndesde tu reloj'}</Text> : null}
        </Text>
        <Pressable
          onPress={onOpen}
          hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Cambiar cuánto dormiste"
        >
          <Text style={styles.link}>cambiar</Text>
        </Pressable>
      </Animated.View>
    )
  }

  // ── La pregunta, con los chips. ──
  // Con noche ya anotada el modo se DECLARA (mismo header que DayCheckIn) y
  // "Listo" cierra sin mutar nada; fresco, la pregunta coach + "Después".
  const editing = hasEntry
  return (
    <Animated.View layout={layout} entering={fadeIn} exiting={fadeOut} style={styles.block}>
      <View style={styles.headRow}>
        {editing ? (
          <Text style={styles.editLead}>Cambiando cuánto dormiste</Text>
        ) : (
          <Text style={styles.question}>
            {past ? '¿Cuánto dormiste esa noche?' : '¿Cuánto dormiste anoche?'}
          </Text>
        )}
        <Pressable
          onPress={() => onClose(editing)}
          hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Listo, cerrar edición' : 'Después, responder más tarde'}
        >
          <Text style={styles.link}>{editing ? 'Listo' : 'Después'}</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {SLEEP_CHIPS.map((c) => {
          const active = c.minutes === activeChip
          return (
            <Pressable
              key={c.minutes}
              onPress={() => pick(c.minutes)}
              hitSlop={{ top: 6, bottom: 6 }}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Dormiste ${c.a11y.toLowerCase()}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Ajustando lo que trajo el reloj: se nombra el dato y se deja elegir. */}
      {fromWatch && wearableMinutes != null ? (
        <Text style={styles.hint}>
          {`Tu reloj anotó ${formatSleepShort(wearableMinutes)} · elige si fue distinto`}
        </Text>
      ) : null}

      {upsert.isError ? (
        <Animated.Text layout={layout} entering={fadeIn} exiting={fadeOut} style={styles.errorLine}>
          No pudimos anotar tu noche. Toca de nuevo cuando tengas señal.
        </Animated.Text>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  block: {
    marginTop: 12,
  },
  // La pregunta (voz coach) o el modo declarado, con su puerta a la derecha.
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginLeft: 2,
  },
  question: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  editLead: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  link: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  // Siete píldoras fantasma a lo ancho (receta "control", igual que los chips
  // de tipo); el activo solo cambia borde y texto a magenta.
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  chipActive: {
    borderColor: colors.magenta,
  },
  chipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  chipTextActive: {
    color: colors.magenta,
  },
  hint: {
    marginTop: 8,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  // Estado respondido — misma fila que el check-in de entreno.
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
  provenance: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.niebla,
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
  // La única línea que la usuaria NECESITA ver — bone, no niebla.
  errorLine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    marginTop: 10,
    marginLeft: 2,
  },
})
