import { useEffect } from 'react'
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, typography } from '@/theme'

import { PatternCorrelationBars } from './PatternCorrelationBars'
import { PatternEvidenceStrip } from './PatternEvidenceStrip'
import { PatternRevealCosmos } from './PatternRevealCosmos'
import { PatternRevealLifeLine } from './PatternRevealLifeLine'

import type { EvidenceBar } from '../month-built'

/*
 * PatternRevealModal — la revelación cinemática del patrón dominante (Órbita·Mes).
 *
 * Metáfora de "línea de vida": al tocar la card, se abre a pantalla completa y la
 * cámara arranca cerrada sobre un cuadro (solo se ve la CAÍDA); un astro recorre
 * la línea, y al llegar a la mitad la cámara hace ZOOM OUT y se revela que la
 * caída era una parte mínima de una trayectoria que sigue subiendo (recuperación).
 * El texto acompaña en dos fases: primero el mal día encerrado; al abrir el
 * contexto, la perspectiva. Toda la mecánica (PatternRevealLifeLine) la conduce un
 * `progress` 0→1 one-shot; el cosmos queda de fondo tenue (combinado, no compite).
 *
 * El texto es la EVIDENCIA del patrón, en dos fases que calzan con la metáfora:
 *   fase 1 (cuadro cerrado) → la observación (la frase del patrón);
 *   fase 2 (al abrir el contexto) → la prueba (coincidieron N días + las fechas).
 *
 * Reduce-motion: progress=1 (estado final, trayectoria completa + astro arriba) y
 * el texto completo, sin animación.
 */

const CLAMP = Extrapolation.CLAMP
const SEQ_MS = 4200

export function PatternRevealModal({
  phrase,
  countLine,
  takeaway,
  evidence,
  bars,
  date,
  eyebrow = 'Nuevo patrón encontrado',
  lifeline = false,
  onClose,
}: {
  /** Fecha legible del día (p.ej. "14 de junio") — contexto de cuándo. */
  date?: string
  /** El marco de descubrimiento: "esto lo saqué de TU tracking" (el
   *  diferenciador de Stelar). Va arriba de la observación. */
  eyebrow?: string
  /** Muestra la "línea de vida" (metáfora de déficit) como héroe cuando no hay
   *  barras ni tira. Solo el combo de Órbita Mes la quiere; los patrones del
   *  calendario sin evidencia visual (p.ej. el noticing) quedan sobre el cosmos. */
  lifeline?: boolean
  /** La frase del patrón (observación, voz de coach). */
  phrase: string
  /** "Coincidieron 7 días. Los 7, en déficit." (la prueba). */
  countLine: string
  /** El cierre útil ("Cuando aparecen juntas, es tu señal más confiable."). */
  takeaway: string
  /** Evidencia VISUAL de frecuencia (patrones de constancia): la tira de días
   *  con `count` encendidos de `total`. Reemplaza a la línea de vida (que es la
   *  metáfora del combo de déficit, no de este patrón). Ausente → línea de vida. */
  evidence?: { count: number; total: number; tone?: 'lit' | 'neutral' }
  /** Etapa 3: la correlación con el déficit (barras pareadas). Es la PRUEBA que
   *  más importa (conecta con el norte) → gana al strip de frecuencia. */
  bars?: EvidenceBar[]
  onClose: () => void
}) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion() ?? false

  // El recorrido completo: cuadro cerrado (0) → zoom out + recuperación (1).
  const progress = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) return
    progress.value = withTiming(1, { duration: SEQ_MS, easing: Easing.inOut(Easing.cubic) })
    return () => cancelAnimation(progress)
  }, [reduced, progress])

  // Texto en dos fases: la 1ª frase entra pronto; la 2ª al abrir el contexto.
  const line1Style = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : interpolate(progress.value, [0.1, 0.22], [0, 1], CLAMP),
  }))
  const line2Style = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : interpolate(progress.value, [0.62, 0.76], [0, 1], CLAMP),
    transform: [
      { translateY: reduced ? 0 : interpolate(progress.value, [0.62, 0.76], [8, 0], CLAMP) },
    ],
  }))

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {/* Todas las capas ABSOLUTAS y superpuestas (si no, cada una de alto
            completo empuja a la siguiente fuera de pantalla). */}
        {/* Cosmos de fondo, tenue (no compite con la línea blanca). */}
        <PatternRevealCosmos width={width} height={height} style={StyleSheet.absoluteFill} />
        <View style={styles.dim} pointerEvents="none" />

        {/* El HÉROE visual, por prioridad de PRUEBA:
            1) barras de correlación con el déficit (lo que conecta con el norte),
            2) tira de frecuencia (la constancia: días reales encendidos),
            3) línea de vida (el combo de déficit de Órbita Mes).
            La usuaria pidió VER su dato, no una animación genérica. */}
        {bars && bars.length > 0 ? (
          <View style={styles.heroWrap} pointerEvents="none">
            <PatternCorrelationBars bars={bars} progress={progress} />
          </View>
        ) : evidence ? (
          <View style={styles.heroWrap} pointerEvents="none">
            <PatternEvidenceStrip
              count={evidence.count}
              total={evidence.total}
              tone={evidence.tone ?? 'lit'}
              progress={progress}
            />
          </View>
        ) : lifeline ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <PatternRevealLifeLine width={width} height={height} progress={progress} />
          </View>
        ) : null}

        {/* La evidencia, en dos fases, abajo. box-none → el toque pasa al fondo.
            Fase 1: la observación (frase). Fase 2 (al abrir el contexto): la
            prueba (conteo + fechas). */}
        <View style={[styles.textWrap, { bottom: insets.bottom + 56 }]} pointerEvents="none">
          {eyebrow ? (
            <Animated.Text style={[styles.eyebrow, line1Style]}>{eyebrow}</Animated.Text>
          ) : null}
          <Animated.Text style={[styles.phrase, line1Style]}>{phrase}</Animated.Text>
          <Animated.View style={line2Style}>
            <Text style={styles.count}>{countLine}</Text>
            <Text style={styles.takeaway}>{takeaway}</Text>
          </Animated.View>
        </View>

        {/* La fecha ARRIBA-izquierda, brillante — ancla de "cuándo" antes de leer. */}
        {date ? (
          <Animated.Text
            style={[styles.dateTop, { top: insets.top + 16 }, line1Style]}
            pointerEvents="none"
          >
            {date}
          </Animated.Text>
        ) : null}

        <Pressable
          onPress={onClose}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 8, 0.55)',
  },
  // La tira de evidencia se centra en el área héroe (donde iba la línea).
  heroWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  // La fecha del día — arriba-izquierda, brillante (leche): ancla de "cuándo".
  dateTop: {
    position: 'absolute',
    left: 24,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
    letterSpacing: 0.3,
  },
  // El marco de descubrimiento: label pequeño en oro, arriba de la observación.
  // "Esto salió de TUS datos" — el diferenciador de Stelar.
  eyebrow: {
    marginBottom: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: colors.oroSoft,
  },
  // Fase 1: la observación del patrón → voz de coach, serif italic.
  phrase: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.displaySm,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.leche,
  },
  // Fase 2: la prueba (dato) → Hanken, centrada, tabular.
  count: {
    marginTop: 20,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  // El cierre útil: es una conclusión/voz de coach → serif italic, cálido.
  takeaway: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.oroLeche,
  },
  close: {
    position: 'absolute',
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  closeX: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.title,
    color: colors.niebla,
  },
})
