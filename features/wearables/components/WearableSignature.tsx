/*
 * La firma del reloj (spec wearables §5 · procedencia sutil): el eyebrow que
 * TITULA el bloque del check-in de Hoy cuando algo vino del dispositivo
 * ("⌚ DESDE TU RELOJ · HACE 2 H"), una sola vez, arriba de las filas. Las
 * filas son las mismas del camino manual (misma gramática, misma estrella);
 * este título es lo único que las distingue y las agrupa. Misma receta que el
 * eyebrow de fecha del modo "ver día". Sin caja, sin verbo, sin ✦.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { useWearableLastSync } from '../hooks'
import { wearableSignature } from '../recovery'

type Props = {
  workout: boolean
  sleep: boolean
  /** Día pasado: la firma no lleva "hace N h" (el sync de hoy no dice nada de ayer). */
  past?: boolean
  /** "ajustar" abre lo que vino del reloj (tipo de entreno, horas de sueño);
   *  cada bloque abierto cierra con sus propias puertas (Cancelar · Listo),
   *  así que mientras se ajusta el eyebrow no lleva link. Las filas del reloj
   *  no llevan "cambiar" propio. */
  adjusting: boolean
  onAdjust: () => void
}

/* Un smartwatch: caja redondeada con dos tramos de correa. Tintable. */
function WatchGlyph({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={6} width={12} height={12} rx={3.5} stroke={color} strokeWidth={1.8} />
      <Path d="M9 6 V3.5 H15 V6 M9 18 V20.5 H15 V18" stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}

export function WearableSignature({ workout, sleep, past = false, adjusting, onAdjust }: Props) {
  const lastSyncAt = useWearableLastSync()
  const text = wearableSignature({ workout, sleep }, past ? null : lastSyncAt, new Date())
  if (!text) return null

  return (
    <View style={styles.row}>
      <View style={styles.lead} accessibilityRole="text" accessibilityLabel={`Anotado ${text}`}>
        <View style={styles.glyph}>
          <WatchGlyph color={colors.niebla} />
        </View>
        <Text style={styles.text}>{text}</Text>
      </View>
      {adjusting ? null : (
        <Pressable
          onPress={onAdjust}
          hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Ajustar lo que anotó tu reloj"
        >
          <Text style={styles.link}>ajustar</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Eyebrow del bloque (misma receta que el de fecha en DayCheckIn), con la
  // puerta a la derecha, donde las filas llevan su "cambiar".
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginLeft: 2,
  },
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Misma columna que ✦ y ☾ (16 px) en las filas de abajo.
  glyph: {
    width: 16,
    alignItems: 'center',
  },
  link: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  text: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
})
