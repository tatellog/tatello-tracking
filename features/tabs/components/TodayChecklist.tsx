import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { usePressFeedback } from '@/components/ui/interaction'
import { UNIVERSE_ACCENT, UNIVERSE_ICON_PATH } from '@/features/tabs/universe-visuals'
import { colors, typography } from '@/theme'

/*
 * "Tu día" — la capa que ORIENTA, no otra recompensa. Una fila de cinco
 * rituales del día (Día · Comida · Agua · Sueño · Ánimo) que se leen de un
 * vistazo: lo registrado brilla, lo que aún no, espera quieto — EXACTAMENTE
 * como una estrella apagada de la constelación, nunca como una tarea fallida.
 *
 * Manifiesto-safe por diseño:
 *   · sin rojo, sin "!", sin "pendiente", sin "X de 5 restantes", sin reloj.
 *   · "Día" cuenta entrenar O descansar — el descanso es válido, no un hueco.
 *   · la frase de cierre SOLO aparece cuando el día está completo (orgullo
 *     callado); si falta algo, silencio — ninguna presión.
 *
 * Cohesión: reusa los iconos + acentos del "universo de hoy", así registrar
 * se siente como alimentar el mismo cielo, no como un sistema huérfano. Tocar
 * un ritual lleva (scroll) a donde se registra.
 */

export type ChecklistTarget = 'top' | 'meals' | 'slider' | 'universe' | 'water'

type RitualKey = 'dia' | 'comida' | 'agua' | 'sueno' | 'animo'

type RitualDef = {
  key: RitualKey
  label: string
  /** SVG path (24×24 viewBox) — reusa la iconografía del universo. */
  path: string
  /** Color encendido cuando el ritual ya se registró. */
  accent: string
  /** A dónde lleva el tap — una sección que ya existe en Hoy. */
  target: ChecklistTarget
}

// El cuatro-puntas de la constelación — "Día" es la estrella raíz del cielo.
const DIA_STAR = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

const RITUALS: readonly RitualDef[] = [
  { key: 'dia', label: 'Día', path: DIA_STAR, accent: colors.magenta, target: 'top' },
  {
    key: 'comida',
    label: 'Comida',
    path: UNIVERSE_ICON_PATH.energia,
    accent: UNIVERSE_ACCENT.energia,
    target: 'meals',
  },
  {
    key: 'agua',
    label: 'Agua',
    path: UNIVERSE_ICON_PATH.claridad,
    accent: UNIVERSE_ACCENT.claridad,
    // El agua solo se registra en la hoja ✦ → la abrimos directo (no scroll).
    target: 'water',
  },
  {
    key: 'sueno',
    label: 'Sueño',
    path: UNIVERSE_ICON_PATH.estabilidad,
    accent: UNIVERSE_ACCENT.estabilidad,
    target: 'slider',
  },
  {
    key: 'animo',
    label: 'Ánimo',
    path: UNIVERSE_ICON_PATH.brillo,
    accent: UNIVERSE_ACCENT.brillo,
    target: 'slider',
  },
]

export type ChecklistState = Record<RitualKey, boolean>

type Props = {
  state: ChecklistState
  onJump: (target: ChecklistTarget) => void
}

/** Un ritual = glifo (encendido o esperando) + etiqueta, tappable. ≥2 señales
 *  de interacción: el cambio de estado del glifo + el press-scale. */
function RitualChip({ def, done, onJump }: { def: RitualDef; done: boolean; onJump: () => void }) {
  const press = usePressFeedback()
  const isStar = def.key === 'dia'

  return (
    <Pressable
      onPress={() => {
        press.triggerHaptic()
        onJump()
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${def.label}, ${done ? 'registrado' : 'sin registrar'}`}
      accessibilityHint="Toca para ir a registrarlo"
      style={styles.chip}
    >
      <Animated.View
        style={[
          styles.disc,
          // Esperando: anillo hairline que ancla la forma sobre el negro warm,
          // para que el glifo tenue se LEA (no se pierda). Encendido: disco
          // tintado del acento, sin borde.
          done ? { backgroundColor: tintBehind(def.accent) } : styles.discWaiting,
          press.animatedStyle,
        ]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d={def.path}
            // Encendido: trazo (o relleno, la estrella) en el acento, vivo.
            // Esperando: trazo niebla con cuerpo — una luz por encender, legible.
            fill={done && isStar ? def.accent : 'none'}
            stroke={done ? def.accent : colors.niebla}
            strokeWidth={done ? 1.9 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={done ? 1 : 0.8}
          />
        </Svg>
      </Animated.View>
      <Text style={[styles.label, done ? styles.labelDone : styles.labelPending]}>{def.label}</Text>
    </Pressable>
  )
}

export function TodayChecklist({ state, onJump }: Props) {
  const allDone = RITUALS.every((r) => state[r.key])

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>TU DÍA</Text>
      <View style={styles.row}>
        {RITUALS.map((def) => (
          <RitualChip
            key={def.key}
            def={def}
            done={state[def.key]}
            onJump={() => onJump(def.target)}
          />
        ))}
      </View>
      {/* Orgullo callado SOLO al completar — si falta algo, silencio. */}
      {allDone ? <Text style={styles.complete}>Tu día está completo.</Text> : null}
    </View>
  )
}

// Disco tenue detrás de un ritual encendido — lo separa del fondo sin gritar.
function tintBehind(hex: string): string {
  // Acentos hex (#rrggbb) → +1F alpha; si ya viene con alpha lo dejamos.
  return hex.startsWith('#') && hex.length === 7 ? `${hex}1F` : hex
}

const DISC = 44

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginBottom: 6,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    textTransform: 'uppercase',
    color: colors.niebla,
    textAlign: 'center',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  discWaiting: {
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 0.2,
  },
  labelDone: {
    color: colors.bone,
  },
  labelPending: {
    color: colors.niebla,
  },
  complete: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
    textAlign: 'center',
    marginTop: 12,
  },
})
