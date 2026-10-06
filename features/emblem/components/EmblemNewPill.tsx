import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

/*
 * El aviso de que el arte del emblema avanzó un cuadro (dueña 6 oct 2026:
 * "que vea que algo se está revelando"). Vive bajo el hero de Hoy, nombra la
 * causa si hoy ya sumó, y se queda hasta que ella abra su {signo}: no se va
 * solo, para que no se pierda. Oro: es algo que ya logró.
 */
export function EmblemNewPill({
  signTitle,
  cause,
  onPress,
}: {
  signTitle: string
  /** "déficit y proteína" (lo de hoy que cuenta) o null. */
  cause: string | null
  onPress: () => void
}) {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  }, [])
  return (
    <Animated.View entering={FadeInDown.duration(380)} exiting={FadeOut.duration(200)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Tu ${signTitle} reveló algo nuevo. Ver`}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="star-four-points" size={15} color={colors.oroSoft} />
        <View style={styles.texts}>
          <Text style={styles.title}>{`Tu ${signTitle} reveló algo nuevo`}</Text>
          {cause ? <Text style={styles.cause}>{`Por tu ${cause} de hoy`}</Text> : null}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.niebla} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  pressed: { opacity: 0.7 },
  texts: { flexShrink: 1 },
  title: { fontFamily: typography.uiBold, fontSize: typography.sizes.body, color: colors.leche },
  cause: {
    marginTop: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
})
