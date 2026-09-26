import { Pressable, StyleSheet, Text, View } from 'react-native'
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

/** El momento que "toca" por hora — el héroe visual de la estela. */
const momentByHour = (): MealMoment => mealMomentByHour()

/* El glifo celeste de cada momento vive en el módulo CANÓNICO compartido
 * (sol/planeta/luna/cometa) — una sola familia en toda la app. */

/* El aro del nodo, dibujado en SVG para lograr el look de la referencia:
 *   · una capa ancha de baja opacidad = el "blur"/glow del aro;
 *   · el aro fino encima;
 *   · puntitos (cuentas de luz) repartidos sobre la circunferencia, asimétricos.
 * `tone` = color del oro; `active` lo hace más brillante y grueso. */
function NodeRing({
  size,
  tone,
  active,
  dim,
}: {
  size: number
  tone: string
  active: boolean
  dim: boolean
}) {
  const c = size / 2
  const r = c - (active ? 3 : 2)
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* glow (el "blur" del aro) */}
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={tone}
        strokeWidth={active ? 6 : 4}
        opacity={active ? 0.18 : 0.1}
        fill="none"
      />
      {/* el aro fino */}
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={tone}
        strokeWidth={active ? 2 : 1.2}
        opacity={active ? 0.95 : dim ? 0.4 : 0.62}
        fill="none"
      />
    </Svg>
  )
}

/* Un nodo de la estela: el disco con su astro. Dos estados, dos señales
 * (dirección de arte + ux sep 2026; antes "ahora" y "registrado" se veían
 * iguales y un badge magenta de conteo se leía como notificación):
 *   lit (registrado) → disco LLENO en oro tenue, astro oro claro.
 *   current (el momento que toca por la hora Y aún vacío) → anillo claro.
 *   pendiente → contorno tenue, astro apagado. */
function MomentNode({ type, lit, current }: { type: MealMoment; lit: boolean; current: boolean }) {
  const size = NODE_BASE
  const glyphColor = lit || current ? colors.oroLight : colors.oroSoft
  const ringTone = current || lit ? colors.oroLight : colors.oro
  return (
    <View style={styles.nodeZone}>
      <View
        style={[
          styles.node,
          { width: size, height: size, borderRadius: size / 2 },
          lit && styles.nodeLit,
        ]}
      >
        <NodeRing size={size} tone={ringTone} active={current} dim={!lit && !current} />
        <MealGlyph type={type} size={Math.round(size * 0.5)} color={glyphColor} />
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
 * cometa). Los astros AGREGAN: tocar cualquiera abre el registro con ese
 * momento preseleccionado. Qué comiste se lee en la lista de abajo
 * (DayMealList), no en un conteo sobre el astro.
 */
export function MomentsToday({ meals, viewingPast }: Props) {
  const registered = new Set(
    MOMENTS.filter((m) => meals.some((meal) => meal.meal_type === m.type)).map((m) => m.type),
  )
  const byHour = momentByHour()

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Hoy</Text>

      <View style={styles.row}>
        {/* La estela — hairline de constelación que une los 4 astros. */}
        <View style={styles.connector} pointerEvents="none" />

        {MOMENTS.map((m) => {
          const lit = registered.has(m.type)
          // "Ahora" solo en el momento que toca por la hora y aún está vacío:
          // lleno gana. En un día pasado no hay "ahora".
          const current = !viewingPast && !lit && m.type === byHour
          const inner = (
            <>
              <MomentNode type={m.type} lit={lit} current={current} />
              <Text style={[styles.label, lit || current ? styles.labelLit : styles.labelOff]}>
                {m.label}
              </Text>
            </>
          )
          return viewingPast ? (
            <View
              key={m.type}
              style={styles.chip}
              accessibilityLabel={`${m.label}, ${lit ? 'registrada' : 'sin registro'}`}
            >
              {inner}
            </View>
          ) : (
            <Pressable
              key={m.type}
              style={styles.chip}
              onPress={() => emitRegistroIntent(m.type)}
              accessibilityRole="button"
              accessibilityLabel={
                lit
                  ? `${m.label}, registrada. Toca para agregar otra.`
                  : current
                    ? `${m.label}, ahora, sin registrar. Toca para registrar.`
                    : `${m.label}, sin registrar. Toca para registrar.`
              }
            >
              {inner}
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

const NODE_BASE = 44
const NODE_ZONE = 66

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
  // Backbone de constelación entre los 4 astros (centros a 1/8 y 7/8), a la
  // altura del centro de los nodos.
  // Backbone de constelación entre los 4 astros (centros a 1/8 y 7/8), a la
  // altura del centro de los nodos (el zone los centra a todos por igual aunque
  // el activo sea más grande).
  connector: {
    position: 'absolute',
    top: NODE_ZONE / 2,
    left: '12.5%',
    right: '12.5%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.oro,
    opacity: 0.3,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  // ── Nodo (disco + astro + badge) ──────────────────────────────────
  // Zona de tamaño fijo: centra el nodo (chico o grande) en la MISMA línea, así
  // el activo crece sin desalinear la estela.
  nodeZone: {
    width: NODE_BASE + 14,
    height: NODE_ZONE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El disco: solo el fondo de la página (recorta la estela) + centra. El aro y
  // los puntitos los dibuja NodeRing (SVG), no un border.
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  // Registrado: el disco se LLENA de oro tenue (el astro ya "encendió").
  nodeLit: {
    backgroundColor: colors.oroGlow,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
  },
  labelLit: {
    color: colors.oroLight,
  },
  // Los pendientes en un oro cálido tenue (no gris), como la referencia.
  labelOff: {
    color: colors.bone,
  },
  // Hint de uso — enseña que se registra TOCANDO un astro. Callado, invitación
  // (no botón, no presión).
  hint: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.bone,
  },
})
