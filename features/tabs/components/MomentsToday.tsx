import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { AMBIENT_MOTION } from '@/lib/motion'
import Svg, { Circle } from 'react-native-svg'

import { MealGlyph } from '@/features/macros/components/meal-glyphs'
import { mealMomentByHour } from '@/features/macros/meal-moment'
import { emitRegistroIntent, type MealMoment } from '@/features/macros/registro-intent'
import { colors, typography } from '@/theme'

const MOMENTS: { type: MealMoment; label: string }[] = [
  { type: 'breakfast', label: 'Desayuno' },
  { type: 'lunch', label: 'Comida' },
  { type: 'dinner', label: 'Cena' },
  { type: 'snack', label: 'Snack' },
]

const NODE = 56
const ZONE = 74

/* El aro del astro: un halo ancho y tenue (el "blur") + el aro fino encima.
 * `active` (el momento que toca) lo hace más brillante y grueso. */
function NodeRing({ tone, active, dim }: { tone: string; active: boolean; dim: boolean }) {
  const c = NODE / 2
  const r = c - (active ? 2.5 : 1.5)
  return (
    <Svg width={NODE} height={NODE} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={tone}
        strokeWidth={active ? 5 : 3}
        opacity={active ? 0.2 : 0.08}
        fill="none"
      />
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={tone}
        strokeWidth={active ? 2 : 1}
        opacity={active ? 0.95 : dim ? 0.35 : 0.6}
        fill="none"
      />
    </Svg>
  )
}

/* El brillo lento del momento que toca: invita sin gritar. Quieto con
 * "reducir movimiento". */
function CurrentGlow() {
  const reduce = useReducedMotion() ?? false
  const t = useSharedValue(0)
  useEffect(() => {
    if (reduce || !AMBIENT_MOTION) {
      t.value = 0.5
      return
    }
    t.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(t)
  }, [reduce, t])
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + t.value * 0.35 }))
  return <Animated.View pointerEvents="none" style={[styles.currentGlow, style]} />
}

/*
 * Un astro como BOTÓN (dueña 26 sep 2026: "no parecen botones"; el "+" en la
 * esquina se leía como globo de notificación). Lo que dice "tócame" es el
 * CUERPO: disco relleno con brillo arriba y sombra abajo, como una tecla, que
 * se hunde al presionar. El "+" vive en la etiqueta del momento que toca.
 *   registrado → el disco se llena de oro tenue, astro oro claro (lo hecho).
 *   ahora (toca por la hora y está vacío) → aro magenta grueso + halo lento.
 *   pendiente → aro neutro tenue, astro hueso.
 */
function MomentNode({
  type,
  lit,
  current,
  pressed,
}: {
  type: MealMoment
  lit: boolean
  current: boolean
  pressed: boolean
}) {
  // Magenta = lo que puedes hacer (el momento que toca); oro = lo que ya
  // hiciste (registrado); pendiente, neutro (dueña 26 sep 2026: "todo muy gold").
  const glyphColor = lit ? colors.oroLight : current ? colors.leche : colors.bone
  const ringTone = lit ? colors.oroLight : current ? colors.magenta : colors.bone
  return (
    <View style={styles.zone}>
      {current ? <CurrentGlow /> : null}
      <View style={[styles.disc, pressed && styles.discPressed]}>
        {lit ? <View style={styles.litFill} pointerEvents="none" /> : null}
        {/* El brillo de arriba: la luz que le da volumen de tecla. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 240, 220, 0.10)', 'rgba(255, 240, 220, 0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={styles.sheen}
        />
        <NodeRing tone={ringTone} active={current} dim={!lit && !current} />
        <MealGlyph type={type} size={Math.round(NODE * 0.46)} color={glyphColor} />
      </View>
    </View>
  )
}

type Props = {
  /** Comidas del día visto (cada una con su meal_type). */
  meals: readonly { meal_type: string }[]
  /** En "modo ver día" la sección es lectura: sin "ahora" ni registro desde aquí. */
  viewingPast: boolean
}

/*
 * "HOY" — los momentos del día como una ESTELA de astros (sol/planeta/luna/
 * cometa). Tocar cualquiera abre el registro con ese momento preseleccionado.
 * Qué comiste se lee en la lista de abajo (DayMealList), no en un conteo.
 */
export function MomentsToday({ meals, viewingPast }: Props) {
  const registered = new Set(
    MOMENTS.filter((m) => meals.some((meal) => meal.meal_type === m.type)).map((m) => m.type),
  )
  const byHour = mealMomentByHour()

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Hoy</Text>

      <View style={styles.row}>
        {/* La estela — hairline de constelación que une los 4 astros. */}
        <View style={styles.connector} pointerEvents="none" />

        {MOMENTS.map((m) => {
          const lit = registered.has(m.type)
          // "Ahora" solo en el momento que toca por la hora y aún está vacío.
          const current = !viewingPast && !lit && m.type === byHour
          const label = (
            <Text
              style={[
                styles.label,
                lit ? styles.labelLit : current ? styles.labelNow : styles.labelOff,
              ]}
            >
              {current ? <Text style={styles.labelPlus}>+ </Text> : null}
              {m.label}
            </Text>
          )
          if (viewingPast) {
            return (
              <View
                key={m.type}
                style={styles.chip}
                accessibilityLabel={`${m.label}, ${lit ? 'registrada' : 'sin registro'}`}
              >
                <View style={styles.chipInner}>
                  <MomentNode type={m.type} lit={lit} current={false} pressed={false} />
                  {label}
                </View>
              </View>
            )
          }
          return (
            <Pressable
              key={m.type}
              style={styles.chip}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                emitRegistroIntent(m.type)
              }}
              accessibilityRole="button"
              accessibilityLabel={
                lit
                  ? `${m.label}, registrada. Toca para agregar otra.`
                  : `Registrar ${m.label.toLowerCase()}${current ? ', ahora' : ''}.`
              }
            >
              {({ pressed }) => (
                <View style={styles.chipInner}>
                  <MomentNode type={m.type} lit={lit} current={current} pressed={pressed} />
                  {label}
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      {/* El instructivo solo con el día vacío: con la primera comida, la lista
          de abajo toma su lugar. Sin conteos ("1 de 4" era un checklist). */}
      {!viewingPast && registered.size === 0 ? (
        <Text style={styles.hint}>Toca un astro para registrar esa comida.</Text>
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
  // La estela entre los 4 astros (centros a 1/8 y 7/8), a la altura de su centro.
  connector: {
    position: 'absolute',
    top: ZONE / 2,
    left: '12.5%',
    right: '12.5%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.oro,
    opacity: 0.3,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
  },
  chipInner: {
    alignItems: 'center',
    gap: 6,
  },
  // Zona fija: todos los astros en la misma línea, con aire para la sombra.
  zone: {
    width: ZONE,
    height: ZONE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // La tecla: relleno opaco (recorta la estela), sombra abajo = volumen.
  disc: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard2,
    ...Platform.select({
      ios: {
        shadowColor: colors.sombra,
        shadowOpacity: 0.55,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 5 },
      },
      default: { elevation: 6 },
    }),
  },
  // Al presionar, la tecla se hunde: baja, se achica y la sombra se acorta.
  discPressed: {
    transform: [{ translateY: 2 }, { scale: 0.94 }],
    ...Platform.select({
      ios: { shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
      default: { elevation: 2 },
    }),
  },
  litFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NODE / 2,
    backgroundColor: colors.oroGlow,
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NODE / 2,
  },
  // El halo del momento que toca, detrás de la tecla.
  currentGlow: {
    position: 'absolute',
    width: NODE + 14,
    height: NODE + 14,
    borderRadius: (NODE + 14) / 2,
    backgroundColor: colors.magentaGlow,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
  },
  labelLit: {
    color: colors.oroLight,
  },
  labelNow: {
    color: colors.magentaHot,
  },
  labelOff: {
    color: colors.bone,
  },
  // El "+" dice "agregar" una vez, en el momento que toca (magenta = registrar).
  labelPlus: {
    fontFamily: typography.uiBold,
  },
  hint: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.bone,
  },
})
