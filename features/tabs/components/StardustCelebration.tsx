import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  usePathValue,
  vec,
  type SkPath,
} from '@shopify/react-native-skia'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import type { StardustPayload } from '../stardust-bus'
import {
  buildStardust,
  stardustAt,
  SUCK_S,
  type Stardust,
  type StardustGeo,
} from '../stardust-logic'

/*
 * Polvo de estrellas · la celebración de registrar una comida (dueña 5 oct
 * 2026: "sutil y sublime"). Unas 14 estrellas finas en oro, champaña y crema
 * suben por curvas suaves desde la tarjeta de comidas, entran al emblema y
 * flotan adentro con su aura de bruma mientras el centro las va jalando;
 * luego se las chupa en cascada (acelerando en espiral) y el emblema respira
 * luz. Sin telón: no tapa la pantalla.
 *
 * Física analítica por estrella (stardust-logic, sin estado por frame). Se
 * agrupan por tono en pocos caminos que se rehacen por frame (usePathValue).
 * Colores ESTÁTICOS: solo se anima geometría y opacidad (animar colores de
 * Skia crashea en device). Todo helper del hilo de UI lleva 'worklet'.
 */

const TONE_COLOR = [colors.oroSoft, colors.oroLight, colors.oroLeche] as const
const SPARK_COLOR = colors.oroLeche
const HAZE = colors.oroLight
const TRAIL_STEP = 0.03

/** Estrella de cuatro puntas centrada en (x, y). */
function addStar(p: SkPath, x: number, y: number, s: number): void {
  'worklet'
  p.moveTo(x, y - s * 2.4)
  p.lineTo(x + s * 0.45, y - s * 0.45)
  p.lineTo(x + s * 2.4, y)
  p.lineTo(x + s * 0.45, y + s * 0.45)
  p.lineTo(x, y + s * 2.4)
  p.lineTo(x - s * 0.45, y + s * 0.45)
  p.lineTo(x - s * 2.4, y)
  p.lineTo(x - s * 0.45, y - s * 0.45)
  p.close()
}

/** Escala de la estrella según su fase: crece al salir, se encoge al entrar. */
function scaleAt(phase: number, k: number): number {
  'worklet'
  if (phase === 0) return 0.6 + 0.4 * Math.min(1, k * 2)
  if (phase === 2) return 1 - k * k * k * 0.7
  return 1
}

function drawStars(p: SkPath, T: number, tone: number, s: Stardust, g: StardustGeo): void {
  'worklet'
  for (let i = 0; i < s.tone.length; i++) {
    if (s.tone[i] !== tone) continue
    const at = stardustAt(s, g, i, T)
    if (!at) continue
    const tw = 0.92 + 0.1 * Math.sin(T * s.twinkle[i]! * 3 + i)
    const sz = s.size[i]! * scaleAt(at.phase, at.k) * tw
    if (tone === 3) p.addCircle(at.x, at.y, sz)
    else addStar(p, at.x, at.y, sz)
  }
}

/** Las auras (la bruma): un círculo por estrella, difuminado con BlurMask. */
function drawAuras(p: SkPath, T: number, s: Stardust, g: StardustGeo): void {
  'worklet'
  for (let i = 0; i < s.tone.length; i++) {
    const at = stardustAt(s, g, i, T)
    if (!at) continue
    const base = s.tone[i] === 3 ? 7 : 11
    const breathe = 0.92 + 0.08 * Math.sin(T * s.twinkle[i]! * 1.5 + i)
    p.addCircle(at.x, at.y, base * scaleAt(at.phase, at.k) * breathe)
  }
}

/** Estelas: largas al volar y al ser succionadas, cortas mientras flota. */
function drawTrails(p: SkPath, T: number, s: Stardust, g: StardustGeo): void {
  'worklet'
  for (let i = 0; i < s.tone.length; i++) {
    const at = stardustAt(s, g, i, T)
    if (!at) continue
    const steps = at.phase === 1 ? 2 : 6
    p.moveTo(at.x, at.y)
    for (let j = 1; j <= steps; j++) {
      const prev = stardustAt(s, g, i, T - j * TRAIL_STEP)
      if (!prev) break
      p.lineTo(prev.x, prev.y)
    }
  }
}

export function StardustCelebration({
  payload,
  playKey,
  onDone,
}: {
  payload: StardustPayload
  playKey: number
  onDone: () => void
}) {
  const router = useRouter()
  const rootRef = useRef<View>(null)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  // Coordenadas de ventana → locales al overlay.
  const g: StardustGeo = useMemo(() => {
    const ox = origin?.x ?? 0
    const oy = origin?.y ?? 0
    return {
      ox: payload.ox - ox,
      oy: payload.oy - oy,
      cx: payload.cx - ox,
      cy: payload.cy - oy,
      r: payload.r,
    }
  }, [payload, origin])
  const s = useMemo(() => buildStardust(playKey * 7919 + 13, g), [playKey, g])
  const total = s.total
  const lastSuck = Math.max(...s.suckAt) + SUCK_S

  const t = useSharedValue(0) // segundos
  useEffect(() => {
    if (!origin) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    t.value = 0
    t.value = withTiming(total, { duration: total * 1000, easing: Easing.linear }, (done) => {
      if (done) runOnJS(onDone)()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, origin != null])

  // Un toque suave cuando el emblema se traga la última estrella.
  const finale = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
  }
  useAnimatedReaction(
    () => t.value >= lastSuck,
    (now, prev) => {
      if (now && prev === false) runOnJS(finale)()
    },
  )

  const gold = usePathValue((p) => {
    'worklet'
    drawStars(p, t.value, 0, s, g)
  })
  const champagne = usePathValue((p) => {
    'worklet'
    drawStars(p, t.value, 1, s, g)
  })
  const cream = usePathValue((p) => {
    'worklet'
    drawStars(p, t.value, 2, s, g)
  })
  const sparks = usePathValue((p) => {
    'worklet'
    drawStars(p, t.value, 3, s, g)
  })
  const auras = usePathValue((p) => {
    'worklet'
    drawAuras(p, t.value, s, g)
  })
  const trails = usePathValue((p) => {
    'worklet'
    drawTrails(p, t.value, s, g)
  })

  // El velo de bruma dentro del emblema: sube mientras flotan, se va con ellas.
  const firstLanding = Math.min(...s.delay.map((d, i) => d + s.flight[i]!))
  const veil = useDerivedValue(() => {
    const T = t.value
    if (T < firstLanding * 0.6) return 0
    if (T < firstLanding + 0.6) return Math.min(1, (T - firstLanding * 0.6) / 1.2)
    if (T > lastSuck) return 0
    return 1 - Math.max(0, (T - (lastSuck - 1.2)) / 1.2)
  })
  // Destello mínimo en el centro cada vez que entra una estrella.
  const suckEnds = s.suckAt.map((a) => a + SUCK_S)
  const glint = useDerivedValue(() => {
    const T = t.value
    let v = 0
    for (let i = 0; i < suckEnds.length; i++) {
      const d = T - suckEnds[i]!
      if (d >= 0 && d < 0.5) v = Math.max(v, 1 - d / 0.5)
    }
    return v * 0.8
  })
  // La respiración del emblema: luz que nace en el centro y se abre adentro.
  const breath = useDerivedValue(() => {
    const p = (t.value - lastSuck) / 1.5
    return p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI) * 0.6
  })
  const breathScale = useDerivedValue(() => {
    const p = Math.max(0, Math.min(1, (t.value - lastSuck) / 1.5))
    return [{ scale: 0.2 + 0.8 * (1 - Math.pow(1 - p, 3)) }]
  })

  // Sigue a la cámara: si la página se mueve mientras corre, toda la capa se
  // desplaza igual (origen y emblema son contenido de la página).
  const scrollSV = payload.scrollY
  const scroll0 = payload.scrollY0 ?? 0
  const follow = useDerivedValue(() => [{ translateY: scrollSV ? scroll0 - scrollSV.value : 0 }])

  // "Stelar encontró algo": al final, solo si esta tanda cruzó una etapa.
  const pillStyle = useAnimatedStyle(() => {
    const v = (t.value - lastSuck - 0.3) / 0.5
    const o = v < 0 ? 0 : v > 1 ? 1 : v
    const dy = scrollSV ? scroll0 - scrollSV.value : 0
    return { opacity: o, transform: [{ translateY: (1 - o) * 8 + dy }] }
  })

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      collapsable={false}
      onLayout={() => rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
    >
      {origin ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group transform={follow}>
            <Group opacity={veil}>
              <Circle cx={g.cx} cy={g.cy} r={g.r * 0.85}>
                <RadialGradient
                  c={vec(g.cx, g.cy)}
                  r={g.r * 0.85}
                  colors={[
                    'rgba(255,236,200,0.16)',
                    'rgba(246,217,160,0.08)',
                    'rgba(232,184,114,0)',
                  ]}
                  positions={[0, 0.6, 1]}
                />
              </Circle>
            </Group>
            <Group opacity={breath} origin={vec(g.cx, g.cy)} transform={breathScale}>
              <Circle cx={g.cx} cy={g.cy} r={g.r * 0.85}>
                <RadialGradient
                  c={vec(g.cx, g.cy)}
                  r={g.r * 0.85}
                  colors={[
                    'rgba(255,240,214,0.5)',
                    'rgba(246,217,160,0.22)',
                    'rgba(232,184,114,0)',
                  ]}
                  positions={[0, 0.5, 1]}
                />
              </Circle>
            </Group>
            <Path path={auras} color={HAZE} opacity={0.22}>
              <BlurMask blur={9} style="normal" />
            </Path>
            <Path
              path={trails}
              color={HAZE}
              style="stroke"
              strokeWidth={6}
              opacity={0.08}
              strokeCap="round"
              strokeJoin="round"
            >
              <BlurMask blur={4} style="normal" />
            </Path>
            <Path
              path={trails}
              color={HAZE}
              style="stroke"
              strokeWidth={0.9}
              opacity={0.4}
              strokeCap="round"
              strokeJoin="round"
            />
            <Path path={gold} color={TONE_COLOR[0]} />
            <Path path={champagne} color={TONE_COLOR[1]} />
            <Path path={cream} color={TONE_COLOR[2]} />
            <Path path={sparks} color={SPARK_COLOR} />
            <Group opacity={glint}>
              <Circle cx={g.cx} cy={g.cy} r={10} color={SPARK_COLOR} opacity={0.6}>
                <BlurMask blur={8} style="normal" />
              </Circle>
            </Group>
          </Group>
        </Canvas>
      ) : null}

      {payload.discovered && origin ? (
        <Animated.View
          style={[styles.pillWrap, { top: g.cy + g.r + 18 }, pillStyle]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => {
              onDone()
              router.navigate('/(tabs)/orbit')
            }}
            accessibilityRole="button"
            accessibilityLabel="Stelar encontró algo. Míralo en Descubre"
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.pillTitle}>✦ Stelar encontró algo</Text>
            <Text style={styles.pillSub}>Míralo en Descubre ›</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  pillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.leche,
    alignItems: 'center',
    shadowColor: colors.sombra,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  pillTitle: { fontFamily: typography.uiBold, fontSize: typography.sizes.ui, color: colors.bg },
  pillSub: {
    marginTop: 2,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
