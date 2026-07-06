import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Ellipse, Path } from 'react-native-svg'

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

/* El glifo celeste de cada momento — su astro en la órbita del día:
 *   desayuno = sol · comida = planeta (anillo) · cena = luna · snack = estrella.
 * SVG en viewBox 24, tintable con `color`. El anillo de saturno usa la prop
 * `rotation` (no `transform` en array — eso se rompe en Android, ver memoria). */
function MealGlyph({ type, size, color }: { type: MealMoment; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {type === 'breakfast' ? (
        <>
          <Circle cx={12} cy={12} r={4.2} fill={color} />
          <Path
            d="M12 2 V4.6 M12 19.4 V22 M2 12 H4.6 M19.4 12 H22 M5 5 L6.8 6.8 M17.2 17.2 L19 19 M17.2 6.8 L19 5 M5 19 L6.8 17.2"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      ) : type === 'lunch' ? (
        <>
          <Circle cx={12} cy={12} r={4.6} fill={color} />
          <Ellipse
            cx={12}
            cy={12}
            rx={9.2}
            ry={3}
            rotation={-22}
            originX={12}
            originY={12}
            stroke={color}
            strokeWidth={1.5}
            fill="none"
          />
        </>
      ) : type === 'dinner' ? (
        <Path d="M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z" fill={color} />
      ) : (
        <>
          {/* Snack = COMETA (núcleo + estela). La estrella de 4 puntas era el
              mismo glifo del FAB Registrar: colisión simbólica. */}
          <Circle cx={15.6} cy={8.4} r={3.6} fill={color} />
          <Path
            d="M12.4 11.6 L5 19 M14.8 13.6 L10 18.4 M10.6 9.2 L6.6 13.2"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  )
}

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
  // Ángulos (grados) de los puntitos — asimétricos a propósito (art-brief).
  const dots = active ? [-58, 40, 150, 232] : [-50, 122, 210]
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
      {/* puntitos sobre el aro */}
      {dots.map((deg) => {
        const a = (deg * Math.PI) / 180
        return (
          <Circle
            key={deg}
            cx={c + r * Math.cos(a)}
            cy={c + r * Math.sin(a)}
            r={active ? 1.7 : 1.3}
            fill={tone}
            opacity={active ? 1 : 0.85}
          />
        )
      })}
    </Svg>
  )
}

/* Un nodo de la estela: el disco con su astro. Estados:
 *   lit (registrado, count>0) → disco dorado encendido + badge de conteo.
 *   awaiting (el que toca) → anillo dorado con halo, invita a registrar.
 *   pendiente → contorno tenue, astro apagado. */
function MomentNode({
  type,
  lit,
  current,
  count,
}: {
  type: MealMoment
  lit: boolean
  /** El momento que "toca" por hora — el HÉROE: más grande, doble anillo + glow
   *  (aunque ya esté registrado). */
  current: boolean
  count: number
}) {
  const size = current ? NODE_ACTIVE : NODE_BASE
  // Los astros van SIEMPRE en oro (como la referencia); solo cambia la
  // intensidad: encendido/actual en oro claro, pendiente en oro suave.
  const glyphColor = lit || current ? colors.oroLight : colors.oroSoft
  const ringTone = current ? colors.oroLight : colors.oro
  return (
    <View style={styles.nodeZone}>
      <View
        style={[
          styles.node,
          { width: size, height: size, borderRadius: size / 2 },
          current && styles.nodeGlow,
        ]}
      >
        <NodeRing size={size} tone={ringTone} active={current} dim={!lit && !current} />
        <MealGlyph type={type} size={Math.round(size * 0.5)} color={glyphColor} />
        {count > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

type Props = {
  /** Comidas del día visto (cada una con su meal_type). */
  meals: readonly { meal_type: string }[]
  /** En "modo ver día" la sección es lectura: nada se registra desde el pasado. */
  viewingPast: boolean
}

/*
 * "HOY" — los momentos del día como una ESTELA de astros que se encienden al
 * registrar (sol/planeta/luna/estrella). El lado PRÁCTICO del Tab Comidas (qué
 * me falta capturar), frente al hero EMOCIONAL (la luna). Contextual +
 * accionable: tocar un momento pendiente abre el registro con ese tipo
 * preseleccionado.
 */
export function MomentsToday({ meals, viewingPast }: Props) {
  const countByType = MOMENTS.reduce<Record<MealMoment, number>>(
    (acc, m) => {
      acc[m.type] = meals.filter((meal) => meal.meal_type === m.type).length
      return acc
    },
    { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
  )
  const registered = new Set(MOMENTS.filter((m) => countByType[m.type] > 0).map((m) => m.type))
  const litCount = registered.size
  const allLit = litCount === MOMENTS.length

  // El momento que "toca" por hora — el HÉROE visual (nodo más grande + glow).
  const byHour = momentByHour()

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Hoy</Text>

      <View style={styles.row}>
        {/* La estela — hairline de constelación que une los 4 astros (centros a
            1/8 y 7/8). Detrás de los nodos. */}
        <View style={styles.connector} pointerEvents="none" />

        {MOMENTS.map((m) => {
          const lit = registered.has(m.type)
          const tappable = !viewingPast && !lit
          // El HÉROE visual = el momento que toca por hora (no el "siguiente
          // pendiente"): en la mañana, Desayuno manda aunque ya esté registrado.
          const current = !viewingPast && m.type === byHour
          const inner = (
            <>
              <MomentNode type={m.type} lit={lit} current={current} count={countByType[m.type]} />
              <Text style={[styles.label, lit || current ? styles.labelLit : styles.labelOff]}>
                {m.label}
              </Text>
            </>
          )
          return tappable ? (
            <Pressable
              key={m.type}
              style={styles.chip}
              onPress={() => emitRegistroIntent(m.type)}
              accessibilityRole="button"
              accessibilityLabel={`${m.label}, sin registrar, toca para registrar`}
            >
              {inner}
            </Pressable>
          ) : (
            <View
              key={m.type}
              style={styles.chip}
              accessibilityLabel={`${m.label}, ${lit ? `${countByType[m.type]} registrado` : 'sin registro'}`}
            >
              {inner}
            </View>
          )
        })}
      </View>

      {/* Sin botón: el registro vive en TOCAR el astro pendiente. Una línea
          callada lo enseña (invitación, no culpa). */}
      {viewingPast ? (
        <Text style={styles.context}>{litCount} de 4 momentos registrados</Text>
      ) : allLit ? (
        <Text style={[styles.context, styles.contextComplete]}>
          Registraste cada momento de hoy.
        </Text>
      ) : (
        <>
          {/* El instructivo solo mientras hace falta: tras el primer registro
              del día, el conteo toma su lugar (el texto-manual permanente era
              ruido para quien ya aprendió el gesto). */}
          {litCount === 0 ? (
            <Text style={styles.hint}>Toca un astro para registrar esa comida.</Text>
          ) : (
            <Text style={styles.count}>{litCount} de 4 momentos registrados</Text>
          )}
        </>
      )}
    </View>
  )
}

const NODE_BASE = 44
const NODE_ACTIVE = 58
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
    width: NODE_ACTIVE + 10,
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
  // Glow del nodo actual — shadow real (blur) que refuerza el aro SVG.
  nodeGlow: {
    shadowColor: colors.oro,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  // Badge de conteo (cuántas comidas en ese momento) — magenta de marca.
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magenta,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  badgeText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    lineHeight: 13,
    color: colors.leche,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 0.3,
  },
  labelLit: {
    color: colors.oroLight,
  },
  // Los pendientes en un oro cálido tenue (no gris), como la referencia.
  labelOff: {
    color: colors.bone,
  },
  // Línea contextual — práctica, upright (no italic: no es voz de coach).
  context: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.2,
    color: colors.bone,
  },
  contextComplete: {
    color: colors.oroLight,
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
  count: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
})
