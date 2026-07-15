import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg'

import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { useProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

/*
 * BodyMap v3 (Epic 08 · canvas "el cuerpo ES la navegación") — la figura
 * (renders por biological_sex) como superficie interactiva:
 *
 * - GIRO por arrastre (mock dueña): 4 renders de la mujer (frente / perfil
 *   der / espalda / perfil izq) que rotan como tornamesa — cada ~70 px de
 *   arrastre avanza un frame con haptic. Las regiones viven en el FRENTE y
 *   (si llega backRegions · músculo/grasa) en la ESPALDA, cada cara con su
 *   calibración y mismas keys/métricas; los perfiles solo son para ver. El
 *   hombre hoy solo tiene frente (sin hint ni gesto).
 * - Tap en región → SPARK (destello de estrella en el centro, one-shot) y
 *   un RESPLANDOR radial que nace del centro (350 ms,
 *   cubic-bezier(0.22,1,0.36,1)) con un NÚCLEO brillante (mock) y RESPIRA
 *   mientras la región está activa (pulso ±4% escala / ±20% opacidad, loop
 *   1.6 s con cancelAnimation) — gradiente SVG ESTÁTICO, Reanimated solo
 *   anima opacity/scale del contenedor. Nunca un rectángulo plano.
 * - Región guardada → outline al 20% + estrella Stelar mínima: el cuerpo se
 *   va ENCENDIENDO con el progreso (cero contadores, cero barras).
 * - Idle → la figura RESPIRA (loop 3.4 s con cancelAnimation), FLOTA y va
 *   al 85% de opacidad para fundirse con el cielo (mock). El giro es
 *   siempre manual (la dueña retiró el auto-giro idle).
 * - PINCH → zoom 1×–2.5×; soltar cerca de 1 regresa solo. Los hotspots van
 *   dentro del contenedor escalado (tacto alineado); el stage recorta.
 *
 * Reanimated-only a propósito (60 fps, solo opacity/transform): Skia quedó
 * fuera porque animar sus gradientes truena en device (memoria del repo).
 * Respeta reduced-motion. PNG pesado → RN <Image> plano (regla del repo).
 * Los Pressable ENVUELVEN un hijo dimensionado (patrón AccountRow · quirk).
 *
 * DIFERIDO con la dueña: relleno con la SILUETA exacta de cada región
 * (máscaras vectoriales por zona) y parallax de sensor (post-beta).
 */

export type BodyRegion = {
  key: string
  label: string
  /** Caja en % de la figura (x,y = esquina sup-izq). */
  x: number
  y: number
  w: number
  h: number
}

// Orden de giro (tornamesa): frente → perfil der → espalda → perfil izq.
const WOMAN_FRAMES = [
  require('../../../assets/body/body-woman/front.png'),
  require('../../../assets/body/body-woman/der.png'),
  require('../../../assets/body/body-woman/back.png'),
  require('../../../assets/body/body-woman/izq.png'),
]
const MAN_FRAMES = [require('../../../assets/body/body-man/front.png')]

const EASE = Easing.bezier(0.22, 1, 0.36, 1)
/** Píxeles de arrastre por frame de giro. */
const DRAG_PER_FRAME = 70
/** Alto reservado al hint "Arrastra para girar". */
const HINT_H = 20

export function BodyMap({
  regions,
  backRegions,
  activeKey,
  completedKeys,
  onSelect,
  height = 340,
}: {
  regions: readonly BodyRegion[]
  /** Zonas calibradas al render de ESPALDA (frame 2). Mismas keys/métricas
   *  que el frente: la báscula mide el segmento completo; la espalda es la
   *  otra cara del mismo dato (pedido dueña: ver los músculos de atrás). */
  backRegions?: readonly BodyRegion[]
  activeKey: string | null
  completedKeys: ReadonlySet<string>
  /** Recibe también el label de la CARA tocada (la espalda puede nombrar
   *  distinto el mismo segmento, p. ej. "Espalda"/"Glúteo"). */
  onSelect: (key: string, label?: string) => void
  height?: number
}) {
  const profile = useProfile()
  const reduced = useReducedMotion()
  const [stageW, setStageW] = useState(0)
  const frames = profile.data?.biological_sex === 'male' ? MAN_FRAMES : WOMAN_FRAMES
  const rotatable = frames.length > 1
  const [frame, setFrame] = useState(0)
  const front = frame === 0
  // Las zonas viven en el frente y (si hay calibración) en la espalda; los
  // perfiles solo son para ver.
  const BACK_FRAME = 2
  const shownRegions: readonly BodyRegion[] = front
    ? regions
    : frame === BACK_FRAME
      ? (backRegions ?? [])
      : []
  // Cambiar de modo (otro set de regiones) regresa al frente: las zonas
  // solo son tocables ahí y quedarse de espaldas se sentiría roto. La dep
  // es la KEY semántica, no la identidad del array (en modo peso llega []
  // recreado por render y resetearía a mitad de un giro · guardián).
  const regionsKey = regions.map((r) => r.key).join(',')
  useEffect(() => {
    setFrame(0)
  }, [regionsKey])

  const figH = rotatable ? height - HINT_H : height
  const asset = frames[frame] ?? frames[0]
  const src = Image.resolveAssetSource(asset)
  const ratio = src && src.height > 0 ? src.width / src.height : 0.66
  const width = Math.round(figH * ratio)
  // Etiquetas satélite (mock dueña): cada región con su nombre y su punto en
  // los márgenes — lado según de qué mitad de la figura viene.
  const figureLeft = Math.max(0, (stageW - width) / 2)

  // Giro por arrastre: pasos discretos con haptic, con wrap-around. El
  // callback vive en un ref para que el gesture memoizado nunca vea una
  // closure vieja (frames.length puede cambiar con biological_sex).
  const stepBy = (delta: number) => {
    Haptics.selectionAsync().catch(() => {})
    setFrame((f) => (((f + delta) % frames.length) + frames.length) % frames.length)
  }
  const stepByRef = useRef(stepBy)
  stepByRef.current = stepBy
  // Wrapper ESTABLE para runOnJS: el worklet captura su closure UNA vez (al
  // memoizar), así que debe capturar esta función fija — que ya en el hilo
  // JS lee el ref fresco. Capturar stepByRef.current directo en el worklet
  // congelaría la versión del primer render.
  const stepByStable = useRef((delta: number) => {
    stepByRef.current(delta)
  }).current
  const lastSteps = useSharedValue(0)
  const zoom = useSharedValue(1)
  const zoomStart = useSharedValue(1)
  // useMemo deliberado (guardián): gestures inline se re-attachan en nativo
  // en cada render — y stepBy→setFrame re-renderiza DURANTE el drag.
  // El React Compiler no memoiza builders fluent con mutación interna.
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(rotatable)
      .minDistance(12)
      // Solo horizontal: un tap con temblor vertical debe FALLAR el pan
      // y dejarle el touch al Pressable del hotspot (guardián).
      .activeOffsetX([-12, 12])
      .failOffsetY([-14, 14])
      .onStart(() => {
        lastSteps.value = 0
      })
      .onUpdate((e) => {
        const steps = Math.round(e.translationX / DRAG_PER_FRAME)
        if (steps !== lastSteps.value) {
          const delta = lastSteps.value - steps
          lastSteps.value = steps
          runOnJS(stepByStable)(delta)
        }
      })
    // Pinch para zoom (1×–2.5×); soltar cerca de 1 regresa solo.
    const pinch = Gesture.Pinch()
      .onStart(() => {
        zoomStart.value = zoom.value
      })
      .onUpdate((e) => {
        zoom.value = Math.min(2.5, Math.max(1, zoomStart.value * e.scale))
      })
      .onEnd(() => {
        if (zoom.value < 1.15) {
          zoom.value = withTiming(1, { duration: 220, easing: EASE })
        }
      })
    return Gesture.Simultaneous(pan, pinch)
  }, [rotatable, lastSteps, stepByStable, zoom, zoomStart])

  // La figura VIVE en capas (todas opacity/transform · reduced-motion las
  // asienta): ENTRADA (sube y aparece al montar), RESPIRACIÓN (pecho ~2%,
  // loop 3.4 s) + FLOTACIÓN (deriva vertical lenta, loop 5.2 s, desfasada)
  // y GIRO (squeeze horizontal breve al cambiar de frame — la tornamesa se
  // siente, no solo cambia la foto). El giro es SIEMPRE manual (la dueña
  // retiró el auto-giro idle el 14 jul 2026); el zoom vive en el pinch.
  const entrance = useSharedValue(0)
  const breath = useSharedValue(0)
  const float = useSharedValue(0)
  const turn = useSharedValue(0)
  useEffect(() => {
    if (reduced) {
      // Asienta la figura (no congelarla a media animación) si el ajuste
      // de reduced-motion cambia en caliente.
      entrance.value = withTiming(1, { duration: 150 })
      breath.value = withTiming(0, { duration: 150 })
      float.value = withTiming(0, { duration: 150 })
      return
    }
    entrance.value = withTiming(1, { duration: 650, easing: EASE })
    breath.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
    float.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => {
      cancelAnimation(breath)
      cancelAnimation(float)
    }
  }, [entrance, breath, float, reduced])

  // Squeeze de giro: al cambiar de frame, un pellizco horizontal que se
  // suelta (220 ms). No corre en el mount inicial.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (reduced) return
    cancelAnimation(turn)
    turn.value = 1
    turn.value = withTiming(0, { duration: 320, easing: EASE })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame])

  const figStyle = useAnimatedStyle(() => ({
    opacity: entrance.value * (1 - turn.value * 0.14),
    transform: [
      {
        translateY: (1 - entrance.value) * 22 + breath.value * -2.5 + (float.value - 0.5) * -8,
      },
      // Zoom por pinch: los hotspots viven dentro del contenedor, así que
      // el tacto sigue alineado al escalar.
      { scale: zoom.value },
      { scaleY: 1 + breath.value * 0.012 },
      { scaleX: (1 + breath.value * 0.004) * (0.97 + 0.03 * entrance.value - turn.value * 0.04) },
    ],
  }))

  return (
    <View
      style={[styles.stage, { height }]}
      onLayout={(e) => setStageW(e.nativeEvent.layout.width)}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width, height: figH }, figStyle]}>
          <Image
            source={asset}
            style={[styles.figure, { width, height: figH }]}
            resizeMode="contain"
          />
          {/* Hotspots del frame actual (frente o espalda, cada uno con su
              calibración; los perfiles no llevan). */}
          {shownRegions.map((r, i) => (
            <RegionHotspot
              key={`${frame}-${r.key}`}
              region={r}
              index={i}
              stageW={width}
              stageH={figH}
              active={activeKey === r.key}
              completed={completedKeys.has(r.key)}
              onSelect={onSelect}
            />
          ))}
        </Animated.View>
      </GestureDetector>
      {/* Etiquetas satélite en los márgenes: nombre + punto; también son
          touch target (más generoso que el hotspot). Siguen al frame que
          tenga zonas (frente o espalda). OJO
          quirk: el LAYOUT (absolute + left/top/width) va en el View
          exterior; el Pressable adentro envuelve contenido con tamaño —
          antes el absolute vivía en el hijo del Pressable y las etiquetas
          se posicionaban contra una caja de tamaño CERO (no se veían). */}
      {stageW > 0
        ? resolveCallouts(shownRegions, figH).map(({ region: r, side, top }) => {
            const active = activeKey === r.key
            const completed = completedKeys.has(r.key)
            return (
              <View
                key={`callout-${r.key}`}
                style={[
                  styles.calloutWrap,
                  { top, width: figureLeft + width * 0.24 },
                  side === 'left' ? { left: 0 } : { right: 0 },
                ]}
              >
                <Pressable
                  onPress={() => onSelect(r.key, r.label)}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label}${completed ? ', registrada' : ''}`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => pressed && { opacity: 0.7 }}
                >
                  <View
                    style={[
                      styles.callout,
                      { justifyContent: side === 'left' ? 'flex-end' : 'flex-start' },
                    ]}
                  >
                    {side === 'right' ? <CalloutDot active={active} completed={completed} /> : null}
                    <Text
                      numberOfLines={1}
                      style={[styles.calloutText, active && styles.calloutTextActive]}
                    >
                      {shortLabel(r.label)}
                    </Text>
                    {side === 'left' ? <CalloutDot active={active} completed={completed} /> : null}
                  </View>
                </Pressable>
              </View>
            )
          })
        : null}
      {rotatable ? (
        <View style={styles.hintRow} pointerEvents="none">
          <Text style={styles.hintArrow}>←</Text>
          <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <Path
              d="M10.4 6a4.4 4.4 0 11-1.3-3.1M9.4 1v2h-2"
              stroke={colors.niebla}
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.hintText}>Arrastra para girar</Text>
          <Text style={styles.hintArrow}>→</Text>
        </View>
      ) : null}
    </View>
  )
}

/** Etiquetas cortas para los márgenes: "Brazo derecho" → "Brazo der." — el
 *  nombre completo vive en el sheet y en accessibilityLabel. */
function shortLabel(label: string): string {
  return label.replace(/ derech[oa]$/, ' der.').replace(/ izquierd[oa]$/, ' izq.')
}

/** Posición vertical de cada etiqueta: centro de su región, y luego se
 *  separan las que caen encimadas en el MISMO lado (mín. 26 px) — Cintura y
 *  Brazo izq. comparten altura y se volvían texto revuelto (bug dueña). */
function resolveCallouts(
  regions: readonly BodyRegion[],
  figH: number,
): { region: BodyRegion; side: 'left' | 'right'; top: number }[] {
  const items = regions.map((r) => ({
    region: r,
    side: (r.x + r.w / 2 < 50 ? 'left' : 'right') as 'left' | 'right',
    top: ((r.y + r.h / 2) / 100) * figH - 12,
  }))
  const MIN_GAP = 26
  for (const side of ['left', 'right'] as const) {
    const col = items.filter((i) => i.side === side).sort((a, b) => a.top - b.top)
    let prev = -Infinity
    for (const it of col) {
      it.top = Math.max(it.top, prev + MIN_GAP)
      prev = it.top
    }
  }
  return items
}

/** El punto de la etiqueta: anillo (pendiente) → magenta (activa) → estrella
 *  mínima (registrada). */
function CalloutDot({ active, completed }: { active: boolean; completed: boolean }) {
  if (completed && !active) {
    return (
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d={fourPointStarPath(6, 6, 4.6)} fill={colors.oroLeche} />
      </Svg>
    )
  }
  return <View style={[styles.calloutRing, active && styles.calloutRingActive]} />
}

function RegionHotspot({
  region,
  index,
  stageW,
  stageH,
  active,
  completed,
  onSelect,
}: {
  region: BodyRegion
  /** Posición en la lista: desfasa el pulso del marcador (onda). */
  index: number
  stageW: number
  stageH: number
  active: boolean
  completed: boolean
  onSelect: (key: string, label?: string) => void
}) {
  const reduced = useReducedMotion()
  const dur = (ms: number) => (reduced ? 0 : ms)

  // Reveal (0→1): el RESPLANDOR nace del centro de la región (gradiente
  // radial estático — solo se anima opacity/scale, la regla del repo).
  const reveal = useSharedValue(active ? 1 : 0)
  // Pulso continuo mientras la región está activa: el highlight respira.
  const pulse = useSharedValue(0)
  // Spark one-shot al activar.
  const spark = useSharedValue(0)
  // Estrella de completado: nace cuando la región queda guardada.
  const star = useSharedValue(completed ? 1 : 0)

  useEffect(() => {
    // Si el valor ya está asentado (montaje/remontaje al cambiar de modo),
    // no re-reproducir la entrada (reanimated-guardian: pop redundante).
    if (reveal.value !== (active ? 1 : 0)) {
      reveal.value = withTiming(active ? 1 : 0, { duration: dur(350), easing: EASE })
      if (active) {
        spark.value = 0
        spark.value = withSequence(
          withTiming(1, { duration: dur(180), easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: dur(320), easing: Easing.in(Easing.quad) }),
        )
      }
    }
    // El pulso vive fuera del guard: debe arrancar/parar aunque la entrada
    // no se re-reproduzca.
    if (active && !reduced) {
      pulse.value = 0
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      )
    } else if (pulse.value !== 0) {
      cancelAnimation(pulse)
      pulse.value = withTiming(0, { duration: dur(200) })
    }
    return () => cancelAnimation(pulse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced])

  useEffect(() => {
    if (star.value === (completed ? 1 : 0)) return
    star.value = withTiming(completed ? 1 : 0, {
      duration: dur(420),
      easing: Easing.out(Easing.back(1.6)),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed])

  // MARCADOR de zona medible (pedido dueña): cada región pendiente lleva un
  // puntito en el cuerpo que PULSA por turnos (desfase por índice → la onda
  // va señalando qué se puede marcar). Visible siempre al 35%; el pulso lo
  // enciende. Se apaga al activar/completar. reduced-motion: punto fijo.
  const marker = useSharedValue(0)
  useEffect(() => {
    if (!completed && !active && !reduced) {
      marker.value = 0
      marker.value = withDelay(
        420 * index,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 1800 }),
          ),
          -1,
          false,
        ),
      )
    } else if (marker.value !== 0) {
      cancelAnimation(marker)
      marker.value = withTiming(0, { duration: 150 })
    }
    return () => cancelAnimation(marker)
  }, [marker, completed, active, reduced, index])

  // Píxeles (no %): el Pressable necesita un hijo con tamaño explícito
  // (quirk del repo) y el resplandor necesita el centro real.
  const l = (region.x / 100) * stageW
  const t = (region.y / 100) * stageH
  const w = (region.w / 100) * stageW
  const h = (region.h / 100) * stageH

  // El resplandor: nace del centro (scale 0.55→1) y luego respira con el
  // pulso (±4% de escala, ±20% de opacidad). Todo math inline (worklet).
  const glowStyle = useAnimatedStyle(() => ({
    opacity: reveal.value * (0.9 + pulse.value * 0.1),
    transform: [{ scale: (0.55 + 0.45 * reveal.value) * (1 + pulse.value * 0.05) }],
  }))
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: spark.value,
    transform: [{ scale: 0.4 + spark.value * 1.1 }],
  }))
  const starStyle = useAnimatedStyle(() => ({
    opacity: star.value,
    transform: [{ scale: star.value }],
  }))
  const markerStyle = useAnimatedStyle(() => ({
    opacity: active || completed ? 0 : 0.35 + marker.value * 0.55,
    transform: [{ scale: 1 + marker.value * 0.3 }],
  }))
  const outlineStyle = useAnimatedStyle(() => ({
    // El outline del 20% vive cuando está guardada y no activa.
    opacity: completed ? (1 - reveal.value) * 1 : 0,
  }))

  // El resplandor desborda la caja de la región para que el borde se funda
  // con la figura (nada de rectángulo plano). Con PISO de tamaño: en zonas
  // delgadas (cintura/abdomen, cajas chaparras) el glow proporcional se veía
  // mínimo (feedback dueña 14 jul 2026).
  const gw = Math.max(w * 2, stageW * 0.62)
  const gh = Math.max(h * 1.8, gw * 0.48)

  return (
    <View style={[styles.hotspot, { left: l, top: t, width: w, height: h }]}>
      {/* Resplandor radial (gradiente ESTÁTICO; Reanimated solo mueve
          opacity/scale del contenedor) con un núcleo brillante (mock). */}
      <Animated.View
        style={[{ position: 'absolute', left: (w - gw) / 2, top: (h - gh) / 2 }, glowStyle]}
        pointerEvents="none"
      >
        <Svg width={gw} height={gh}>
          <Defs>
            <RadialGradient id={`glow-${region.key}`} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={colors.magentaHot} stopOpacity={0.78} />
              <Stop offset="0.45" stopColor={colors.magenta} stopOpacity={0.46} />
              <Stop offset="0.78" stopColor={colors.magenta} stopOpacity={0.18} />
              <Stop offset="1" stopColor={colors.magenta} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={gw / 2}
            cy={gh / 2}
            rx={gw / 2}
            ry={gh / 2}
            fill={`url(#glow-${region.key})`}
          />
          <Ellipse
            cx={gw / 2}
            cy={gh / 2}
            rx={6.5}
            ry={6.5}
            fill={colors.magentaHot}
            opacity={0.9}
          />
          <Ellipse cx={gw / 2} cy={gh / 2} rx={2.8} ry={2.8} fill={colors.leche} opacity={0.95} />
        </Svg>
      </Animated.View>
      {/* Marcador de zona medible: puntito que pulsa por turnos. */}
      <Animated.View style={[styles.marker, markerStyle]} pointerEvents="none">
        <View style={styles.markerRing} />
        <View style={styles.markerDot} />
      </Animated.View>
      {/* Guardada: outline 20% + la estrella mínima que enciende el cuerpo. */}
      <Animated.View style={[styles.savedOutline, outlineStyle]} pointerEvents="none" />
      <Animated.View style={[styles.star, starStyle]} pointerEvents="none">
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d={fourPointStarPath(7, 7, 5.4)} fill={colors.oroLeche} />
        </Svg>
      </Animated.View>
      {/* Spark del tap, en el centro. */}
      <Animated.View style={[styles.spark, sparkStyle]} pointerEvents="none">
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Path d={fourPointStarPath(11, 11, 8)} fill={colors.leche} opacity={0.9} />
        </Svg>
      </Animated.View>
      <Pressable
        onPress={() => onSelect(region.key, region.label)}
        accessibilityRole="button"
        accessibilityLabel={`${region.label}${completed ? ', registrada' : ''}`}
        accessibilityState={{ selected: active }}
        hitSlop={4}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <View style={{ width: w, height: h }} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  // overflow hidden: el zoom (hasta 2.5×) no debe sangrar sobre chips/sheet.
  stage: { alignItems: 'center', width: '100%', overflow: 'hidden' },
  // La figura se funde con el cielo (mock): nunca al 100% de opacidad.
  figure: { opacity: 0.85 },
  hotspot: { position: 'absolute' },
  hintRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HINT_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hintText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  hintArrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.bruma,
  },
  calloutWrap: { position: 'absolute' },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  calloutText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.3,
    color: colors.niebla,
    flexShrink: 1,
  },
  calloutTextActive: { color: colors.magentaHot, fontFamily: typography.uiBold },
  calloutRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  calloutRingActive: {
    borderColor: colors.magentaHot,
    backgroundColor: colors.magentaHot,
  },
  savedOutline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 72, 134, 0.2)',
  },
  star: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -7,
    marginTop: -7,
  },
  marker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -7,
    marginTop: -7,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  markerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.magentaHot,
  },
  spark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -11,
    marginTop: -11,
  },
})
