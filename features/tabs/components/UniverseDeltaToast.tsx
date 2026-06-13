import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

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

// El sello ✦ — chispa de cuatro puntas en oro, la firma "esto alimentó
// tu cielo". Estática.
function StarSeal({ size = 13 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 L13.4 10.6 L21 12 L13.4 13.4 L12 21 L10.6 13.4 L3 12 L10.6 10.6 Z"
        fill={colors.oro}
      />
    </Svg>
  )
}

function AttributeGlyph({ attrKey, color }: { attrKey: UniverseAttributeKey; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
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

// El pill en sí. Vive como hijo CONDICIONAL de un wrap SIEMPRE montado —
// así el `exiting` FadeOut corre de verdad: si el componente entero
// hiciera `return null`, React desmontaría el árbol antes de que
// Reanimated capture el nodo y la salida se cortaría en seco.
function DeltaPill({ moment }: { moment: Moment }) {
  const accent = UNIVERSE_ACCENT[moment.key]
  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      exiting={FadeOut.duration(220)}
      // El pill FLOTA iluminado — el glow del acento lo separa del negro
      // warm en vez de fundirse con él (bgCard ≈ bg).
      style={[styles.toast, { borderColor: tint(accent, '80'), shadowColor: accent }]}
    >
      <StarSeal />
      <AttributeGlyph attrKey={moment.key} color={accent} />
      {/* key=seq re-monta el número en cada acumulación — un pop suave,
          suficiente para sentir que el tap sumó. */}
      <Animated.Text
        key={moment.seq}
        entering={FadeIn.duration(140)}
        style={[styles.delta, { color: accent }]}
      >
        +{moment.delta}
      </Animated.Text>
      <Text style={styles.label}>{ATTRIBUTE_LABEL[moment.key]}</Text>
    </Animated.View>
  )
}

export function UniverseDeltaToast({ placement = 'bottom', haptics = true }: Props) {
  const [moment, setMoment] = useState<Moment | null>(null)
  // El haptic solo al APARECER el toast — visible.current evita que cada
  // vaso acumulado vuelva a vibrar encima del selection del tap.
  const visible = useRef(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = subscribeUniverseDelta(({ key, delta }) => {
      if (haptics && !visible.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      }
      visible.current = true
      setMoment((prev) =>
        prev && prev.key === key
          ? { key, delta: prev.delta + delta, seq: prev.seq + 1 }
          : { key, delta, seq: 0 },
      )
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        visible.current = false
        setMoment(null)
      }, VISIBLE_MS)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [haptics])

  // El wrap está SIEMPRE montado (vacío y pointer-none cuando no hay
  // momento) para que el `exiting` del pill corra de verdad.
  return (
    <View
      style={[styles.wrap, placement === 'top' ? styles.wrapTop : styles.wrapBottom]}
      pointerEvents="none"
    >
      {moment ? <DeltaPill moment={moment} /> : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: colors.bgCard2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
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
