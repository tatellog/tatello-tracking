import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group as SkiaGroup,
  LinearGradient as SkiaLinearGradient,
  RadialGradient as SkiaRadialGradient,
  Rect as SkiaRect,
  vec,
} from '@shopify/react-native-skia'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { type WeekDimension, type WeekDimKey } from '../week-orbit-logic'
import { hexRgb, weekDimGlyph, WEEK_DIM_COLOR } from './week-dim-visual'

/*
 * La galaxia de la Semana — lenguaje de Órbita. La galaxia pintada
 * (`orbit-week-art.png`) gira lento de fondo como nebulosa viva; sobre ella,
 * las 5 dimensiones son ESTRELLAS de su color con bloom + flare (Skia, blur
 * real, misma técnica que Órbita Día). La MASA de cada estrella crece con los
 * días presentes esta semana — evidencia acumulada, no predicción.
 *
 * Tocar una estrella la ENFOCA: su ícono viaja al centro y hace zoom (mismo
 * focus cinemático que el hero de Día: traslada + escala con rebote, háptico
 * de aterrizaje), y el resto de la galaxia se atenúa. Tocar de nuevo cierra.
 */

const GALAXY_ART = require('@/assets/orbits-art/orbit-week-art.png')

const R_MIN = 6
const R_MAX = 15

type StarLayout = {
  dim: WeekDimension
  x: number
  y: number
  R: number
}

type Props = {
  dims: readonly WeekDimension[]
  size?: number
  /** Notifica qué dimensión está enfocada (null = ninguna) para que el padre
   *  muestre su readout de información, como el hero de Día. */
  onFocusChange?: (key: WeekDimKey | null) => void
  /** Dimensión a auto-enfocar al montar (para que el readout no dependa de un
   *  tap). null = arranca sin enfoque. */
  initialFocus?: WeekDimKey | null
}

export function WeekOrbitGalaxy({ dims, size, onFocusChange, initialFocus = null }: Props) {
  const { width } = useWindowDimensions()
  const reduce = useReducedMotion()
  const S = size ?? Math.min(width - 40, 330)
  const center = S / 2
  const ringR = S * 0.34

  const [selected, setSelected] = useState<WeekDimKey | null>(initialFocus)
  // Se conserva durante el zoom-out (no se limpia al cerrar) para que el ícono
  // pueda animar de regreso a su estrella en lugar de desaparecer de golpe.
  const [focusKey, setFocusKey] = useState<WeekDimKey | null>(initialFocus)

  // Auto-enfoque: avisa al padre al montar para que su readout aparezca sin
  // depender de un tap.
  useEffect(() => {
    if (initialFocus) onFocusChange?.(initialFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stars: StarLayout[] = dims.map((dim, i) => {
    const angle = (-90 + (i * 360) / dims.length) * (Math.PI / 180)
    return {
      dim,
      x: center + ringR * Math.cos(angle),
      y: center + ringR * Math.sin(angle),
      R: R_MIN + dim.ratio * (R_MAX - R_MIN),
    }
  })
  const focusStar = stars.find((s) => s.dim.key === focusKey) ?? null

  // Nebulosa viva: la galaxia pintada gira muy lento (90 s/vuelta).
  const spin = useSharedValue(0)
  useEffect(() => {
    if (reduce) return
    spin.value = withRepeat(withTiming(1, { duration: 90_000, easing: Easing.linear }), -1, false)
  }, [spin, reduce])
  const nebula = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }))

  // Atenúa estrellas + etiquetas al enfocar, para que el ícono centrado destaque.
  const focused = useSharedValue(0)
  useEffect(() => {
    focused.value = withTiming(selected != null ? 1 : 0, {
      duration: 300,
      easing: Easing.inOut(Easing.cubic),
    })
  }, [selected, focused])
  const bgStyle = useAnimatedStyle(() => ({ opacity: 1 - focused.value * 0.72 }))

  const onTapStar = (key: WeekDimKey) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync()
    const next = selected === key ? null : key
    if (next) setFocusKey(next)
    setSelected(next)
    onFocusChange?.(next)
  }

  const close = () => {
    setSelected(null)
    onFocusChange?.(null)
  }

  return (
    <Animated.View entering={FadeIn.duration(500)} style={[styles.canvas, { width: S, height: S }]}>
      {/* Fondo: nebulosa pintada, girando lento. */}
      <Animated.Image
        source={GALAXY_ART}
        style={[{ width: S, height: S }, nebula]}
        resizeMode="contain"
      />

      {/* Backdrop — al enfocar, tocar FUERA del ícono (cualquier zona vacía)
          cierra. Va bajo la capa de estrellas (box-none), así que tocar otra
          estrella la cambia y tocar vacío cierra. */}
      {selected != null ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar enfoque"
        />
      ) : null}

      {/* Estrellas + etiquetas + hitboxes — se atenúan al enfocar. */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]} pointerEvents="box-none">
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {stars.map((s) => (
            <Star key={s.dim.key} s={s} />
          ))}
        </Canvas>

        {stars.map((s) => {
          const color = WEEK_DIM_COLOR[s.dim.key]
          const hit = Math.max(56, s.R * 4)
          return (
            <View key={s.dim.key} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              <Pressable
                onPress={() => onTapStar(s.dim.key)}
                style={{
                  position: 'absolute',
                  left: s.x - hit / 2,
                  top: s.y - hit / 2,
                  width: hit,
                  height: hit,
                }}
                accessibilityRole="button"
                accessibilityLabel={`${s.dim.label}: ${s.dim.present} de ${s.dim.total} días. Toca para enfocar.`}
              />
              <View
                pointerEvents="none"
                style={[styles.labelWrap, { left: s.x - 40, top: s.y + s.R * 2.1 }]}
              >
                <Text style={[styles.count, { color }]}>
                  {s.dim.present}/{s.dim.total}
                </Text>
                <Text style={styles.label}>{s.dim.label}</Text>
              </View>
            </View>
          )
        })}
      </Animated.View>

      {/* Ícono enfocado — viaja de su estrella al centro con zoom (focus de Día). */}
      <FocusLayer star={focusStar} center={center} active={selected != null} onClose={close} />
    </Animated.View>
  )
}

/* Una estrella Skia: bloom de color + bloom blanco + cruz de flare + núcleo.
 * Sin presencia → brasa hueca (anillo tenue), nunca falla. Estática: el
 * movimiento lo aporta la nebulosa de fondo. */
function Star({ s }: { s: StarLayout }) {
  const { x, y, R, dim } = s
  const color = WEEK_DIM_COLOR[dim.key]
  const rgb = hexRgb(color)

  if (dim.present === 0) {
    return (
      <SkiaGroup transform={[{ translateX: x }, { translateY: y }]}>
        <SkiaCircle
          c={vec(0, 0)}
          r={R * 1.4}
          color={color}
          style="stroke"
          strokeWidth={1.2}
          opacity={0.4}
        />
        <SkiaCircle c={vec(0, 0)} r={R * 0.4} color={color} opacity={0.5} />
      </SkiaGroup>
    )
  }

  return (
    <SkiaGroup transform={[{ translateX: x }, { translateY: y }]}>
      {/* Bloom — color + blanco, blur real, aditivo sobre la nebulosa. */}
      <SkiaGroup blendMode="screen">
        <SkiaCircle c={vec(0, 0)} r={R * 3.4}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={R * 3.4}
            colors={[`rgba(${rgb},0.6)`, `rgba(${rgb},0.16)`, `rgba(${rgb},0)`]}
          />
          <BlurMask blur={R * 1.4} style="normal" />
        </SkiaCircle>
        <SkiaCircle c={vec(0, 0)} r={R * 1.5}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={R * 1.5}
            colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
          />
          <BlurMask blur={R * 0.7} style="normal" />
        </SkiaCircle>
      </SkiaGroup>

      {/* Cruz de flare — dos rayos perpendiculares, suaves. */}
      <SkiaGroup blendMode="plus">
        {[0, 90].map((ang) => (
          <SkiaGroup key={ang} transform={[{ rotate: (ang * Math.PI) / 180 }]}>
            <SkiaRect x={-R * 4.5} y={-R * 0.12} width={R * 9} height={R * 0.24}>
              <SkiaLinearGradient
                start={vec(-R * 4.5, 0)}
                end={vec(R * 4.5, 0)}
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
                positions={[0, 0.5, 1]}
              />
              <BlurMask blur={R * 0.4} style="normal" />
            </SkiaRect>
          </SkiaGroup>
        ))}
      </SkiaGroup>

      {/* Núcleo */}
      <SkiaCircle c={vec(0, 0)} r={R * 0.55} color="#FFFFFF" opacity={0.95} />
    </SkiaGroup>
  )
}

/* El ícono enfocado — SIEMPRE montado (invisible en reposo). Al activarse,
 * viaja de su estrella (ox,oy) al centro y escala con rebote 1.08 (mismo focus
 * que el hero de Día) + háptico de aterrizaje. Al cerrar, regresa y se apaga. */
function FocusLayer({
  star,
  center,
  active,
  onClose,
}: {
  star: StarLayout | null
  center: number
  active: boolean
  onClose: () => void
}) {
  const focus = useSharedValue(0)
  const ox = useSharedValue(center)
  const oy = useSharedValue(center)

  useEffect(() => {
    if (active && star) {
      ox.value = star.x
      oy.value = star.y
      focus.value = withSequence(
        withTiming(1.08, { duration: 480, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 240, easing: Easing.inOut(Easing.cubic) }),
      )
      const id = setTimeout(() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        }
      }, 470)
      return () => clearTimeout(id)
    }
    focus.value = withTiming(0, { duration: 360, easing: Easing.inOut(Easing.cubic) })
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, star?.x, star?.y])

  const aStyle = useAnimatedStyle(() => {
    const mix = Math.min(1, focus.value)
    return {
      opacity: Math.min(1, focus.value * 2),
      transform: [
        { translateX: (ox.value - center) * (1 - mix) },
        { translateY: (oy.value - center) * (1 - mix) },
        { scale: 0.4 + focus.value * 0.6 },
      ],
    }
  })

  const GLYPH = 64
  const BOX = 104
  const dimKey: WeekDimKey | undefined = star?.dim.key
  const color = dimKey ? WEEK_DIM_COLOR[dimKey] : colors.magenta

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={[
        styles.glyphWrap,
        {
          width: BOX,
          height: BOX,
          borderRadius: BOX / 2,
          left: center - BOX / 2,
          top: center - BOX / 2,
          borderColor: color,
        },
        aStyle,
      ]}
    >
      <Pressable
        onPress={onClose}
        style={styles.focusPress}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
      >
        {dimKey ? weekDimGlyph(dimKey, GLYPH) : null}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    alignSelf: 'center',
    position: 'relative',
  },
  glyphWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 6, 8, 0.62)',
    borderWidth: 1,
  },
  focusPress: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
  },
  count: {
    fontFamily: typography.uiBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  label: {
    fontFamily: typography.ui,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: colors.niebla,
    marginTop: 1,
  },
})
