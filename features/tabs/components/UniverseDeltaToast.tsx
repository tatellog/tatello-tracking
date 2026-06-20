import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { requestUniverseDetail } from '@/features/tabs/pending-universe-detail'
import { subscribeUniverseDelta } from '@/features/tabs/universe-delta-bus'
import { ATTRIBUTE_LABEL, type UniverseAttributeKey } from '@/features/tabs/universe-rewards'
import { tint, UNIVERSE_ACCENT, UNIVERSE_ICON_PATH } from '@/features/tabs/universe-visuals'
import { colors, typography } from '@/theme'

/*
 * El toast astral — la recompensa INMEDIATA del registro: "✦ +13
 * Claridad", tintado del atributo, con glow del acento, ~2.2 s, haptic
 * ligero. Los cards de "Tu universo hoy" muestran el acumulado; esto
 * muestra el instante. Escucha el universe-delta-bus, cuya fuente es el
 * MISMO cálculo que pinta los cards — toast y card nunca se contradicen.
 *
 * DOS montajes:
 *   · placement="bottom" (default) — el global, montado una vez en el
 *     tabs layout: paga los registros hechos FUERA de un modal (sliders
 *     de Hoy, escaneo).
 *   · placement="top" + haptics=false — montado DENTRO del QuickLogSheet
 *     (un Modal nativo que tapa el toast global): el "+N" aparece sobre
 *     la hoja, donde el dedo registra. Sin haptic porque el tap del
 *     registro ya vibró — apilar otro leería a doble buzz.
 *
 * Taps seguidos del mismo atributo (vasos, ±15 min de sueño) ACUMULAN en
 * el toast visible (+13 → +26) en vez de spamear. Pure fade
 * (reduced-motion safe), pointer-transparent, glifo estático.
 */

const VISIBLE_MS = 3000

// El PORQUÉ del toast — qué registro alimentó el atributo. Crea aprendizaje:
// la usuaria conecta "+27 Energía" con la acción que lo causó.
const REASON: Record<UniverseAttributeKey, string> = {
  energia: 'por tu comida',
  claridad: 'por tu agua',
  estabilidad: 'por tu sueño',
  brillo: 'por tu ánimo',
}

type Moment = {
  key: UniverseAttributeKey
  delta: number
  /** Cambia con cada acumulación — re-monta el número para que "pope". */
  seq: number
}

type Props = {
  placement?: 'bottom' | 'top'
  /** El haptic propio del toast. Apágalo donde el gesto ya vibró. */
  haptics?: boolean
}

function AttributeGlyph({
  attrKey,
  color,
  size = 18,
}: {
  attrKey: UniverseAttributeKey
  color: string
  size?: number
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={UNIVERSE_ICON_PATH[attrKey]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// El badge de la dimensión — ícono dentro de un aro de su color, ECO del
// mismo badge de los cards de "Tu universo hoy". Es la respuesta a "¿qué
// es esto?": el gota-azul = Claridad, la llama-magenta = Energía, etc.
// Reconocimiento instantáneo y un solo idioma de color en todo el sistema.
function DimensionBadge({ attrKey, color }: { attrKey: UniverseAttributeKey; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: tint(color, '1F') }]}>
      <AttributeGlyph attrKey={attrKey} color={color} size={17} />
    </View>
  )
}

// El pill en sí. Vive como hijo CONDICIONAL de un wrap SIEMPRE montado —
// así el `exiting` FadeOut corre de verdad: si el componente entero
// hiciera `return null`, React desmontaría el árbol antes de que
// Reanimated capture el nodo y la salida se cortaría en seco.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

function DeltaPill({ moment, onPress }: { moment: Moment; onPress?: () => void }) {
  const accent = UNIVERSE_ACCENT[moment.key]
  const interactive = onPress != null
  // El pill FLOTA iluminado — el glow del acento lo separa del negro warm.
  // Tappable solo en el toast global (bottom): lleva al detalle del
  // atributo en "Tu universo hoy". El de la hoja (top) queda inerte.
  const Container = interactive ? AnimatedPressable : Animated.View
  return (
    <Container
      entering={FadeIn.duration(240)}
      exiting={FadeOut.duration(220)}
      onPress={onPress}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={
        interactive
          ? `+${moment.delta} ${ATTRIBUTE_LABEL[moment.key]}. Ver de dónde viene`
          : undefined
      }
      style={[styles.toast, { borderColor: tint(accent, '80'), shadowColor: accent }]}
    >
      <View style={styles.toastRow}>
        {/* El badge de la dimensión LIDERA — color + ícono = "qué es esto". */}
        <DimensionBadge attrKey={moment.key} color={accent} />
        {/* key=seq re-monta el número en cada acumulación — un pop suave,
            suficiente para sentir que el tap sumó. */}
        <Animated.Text
          key={moment.seq}
          entering={FadeIn.duration(140)}
          style={[styles.delta, { color: accent }]}
        >
          +{moment.delta}
        </Animated.Text>
        {/* La etiqueta en SU color (no crema): refuerza la identidad. */}
        <Text style={[styles.label, { color: accent }]}>{ATTRIBUTE_LABEL[moment.key]}</Text>
      </View>
      {/* El porqué — convierte la recompensa en aprendizaje. */}
      <Text style={styles.reason}>{REASON[moment.key]}</Text>
    </Container>
  )
}

export function UniverseDeltaToast({ placement = 'bottom', haptics = true }: Props) {
  const router = useRouter()
  // COLA de momentos: queue[0] es el que se muestra. Cuando dos atributos
  // suben a la vez (comida → Energía + agua → Claridad), cada uno se encola y
  // se muestran ENCADENADOS en vez de pisarse. Taps repetidos del mismo
  // atributo ACUMULAN en su entrada (no spamean la cola).
  const [queue, setQueue] = useState<Moment[]>([])
  const head = queue[0] ?? null

  // Solo el toast global (bottom) es tappable: lleva a Hoy y abre el
  // detalle de ese atributo (reusa el panel de "Tu universo hoy"). El de
  // la hoja (top) vive sobre un Modal y debe quedar inerte para no robar
  // taps al registro.
  const handlePress =
    placement === 'bottom' && head
      ? () => {
          const key = head.key
          Haptics.selectionAsync().catch(() => {})
          requestUniverseDetail(key)
          router.navigate('/')
        }
      : undefined

  useEffect(() => {
    const unsub = subscribeUniverseDelta(({ key, delta }) => {
      setQueue((prev) => {
        const i = prev.findIndex((m) => m.key === key)
        if (i >= 0) {
          // Ya hay un "+N" de este atributo (mostrándose o en cola) → acumula.
          const next = prev.slice()
          next[i] = { key, delta: next[i]!.delta + delta, seq: next[i]!.seq + 1 }
          return next
        }
        return [...prev, { key, delta, seq: 0 }]
      })
    })
    return unsub
  }, [])

  // Avanza la cola: el de adelante vive VISIBLE_MS y luego sale; entonces
  // entra el siguiente. El haptic suena UNA vez por pill nuevo (no en cada
  // acumulación), comparando contra el último atributo que vibró.
  const lastHapticKey = useRef<UniverseAttributeKey | null>(null)
  useEffect(() => {
    if (!head) {
      lastHapticKey.current = null
      return
    }
    if (haptics && head.key !== lastHapticKey.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
    lastHapticKey.current = head.key
    const timer = setTimeout(() => setQueue((prev) => prev.slice(1)), VISIBLE_MS)
    return () => clearTimeout(timer)
    // `head` como dep: su identidad cambia exactamente cuando cambia el de
    // adelante (nuevo atributo) o se acumula (nuevo objeto) → reinicia el
    // temporizador. Un re-render que no toca la cola no lo re-corre.
  }, [head, haptics])

  // El wrap está SIEMPRE montado (vacío y pointer-none cuando no hay
  // momento) para que el `exiting` del pill corra de verdad.
  return (
    <View
      style={[styles.wrap, placement === 'top' ? styles.wrapTop : styles.wrapBottom]}
      // box-none en el global: el área vacía deja pasar el toque, pero el
      // pill (Pressable) sí lo recibe. En la hoja queda 'none' (inerte).
      pointerEvents={placement === 'bottom' ? 'box-none' : 'none'}
    >
      {head ? <DeltaPill key={head.key} moment={head} onPress={handlePress} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // Centrado, pointer-transparent (nunca bloquea un tap).
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Sobre la tab bar — para registros hechos fuera de un modal.
  wrapBottom: {
    bottom: 112,
  },
  // Sobre la hoja — dentro del QuickLogSheet, donde el dedo registra.
  wrapTop: {
    top: 64,
  },
  toast: {
    alignItems: 'center',
    gap: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: colors.bgCard2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  toastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  // El aro de la dimensión — mismo lenguaje que los cards de "Tu universo
  // hoy": ícono tintado dentro de un círculo de su acento.
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reason: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  delta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.deltaNum,
    fontVariant: ['tabular-nums'],
    lineHeight: typography.sizes.deltaNum + 2,
  },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
  },
})
