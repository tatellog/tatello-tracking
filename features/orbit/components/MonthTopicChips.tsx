import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors, radius, shadows, typography } from '@/theme'

import type { ChatTopic, TopicPicker } from '../month-chat'

/*
 * La "repisa" de temas de Órbita Mes IA — los chips-puerta de la antesala.
 * Cada chip abre la conversación de ese tema en su sala (sheet). No es un menú
 * ni un segmented control: cada uno es una PUERTA a un descubrimiento.
 *
 * Rol separado del de los botones de respuesta (esos viven dentro de la sala):
 * aquí el oro ✦ = "esto es un cuerpo de tu cielo", el pill magenta = "es
 * tocable". "Sorpréndeme" es la puerta-misterio: tratamiento propio, magenta
 * sólido, porque no sabes qué hay detrás (máxima anticipación, cero esfuerzo).
 */

type Props = {
  picker: TopicPicker
  onPick: (topic: ChatTopic) => void
}

export function MonthTopicChips({ picker, onPick }: Props) {
  const topics = picker.choices.filter((c) => c.topic !== 'sorprendeme')
  const surprise = picker.choices.find((c) => c.topic === 'sorprendeme')

  return (
    <View style={styles.shelf}>
      <Text style={styles.invite}>¿Por dónde empezamos?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {topics.map((c) => (
          <Chip key={c.topic} label={c.label} onPress={() => onPick(c.topic)} />
        ))}
        {surprise ? (
          <Chip label={surprise.label} onPress={() => onPick(surprise.topic)} mystery />
        ) : null}
      </ScrollView>
    </View>
  )
}

function Chip({
  label,
  onPress,
  mystery = false,
}: {
  label: string
  onPress: () => void
  mystery?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        mystery ? styles.chipMystery : styles.chipNormal,
        pressed && (mystery ? styles.chipMysteryPressed : styles.chipNormalPressed),
      ]}
    >
      <Star color={mystery ? colors.blanco : colors.oroVect} />
      <Text style={[styles.chipText, mystery ? styles.chipMysteryText : styles.chipNormalText]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Estrella ✦ de 4 puntas — la firma del cielo (mismo path que la emisora). */
function Star({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d="M12 4 Q12.8 10.2 18 12 Q12.8 13.8 12 20 Q11.2 13.8 6 12 Q11.2 10.2 12 4 Z"
        fill={color}
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  shelf: {
    gap: 12,
    // Repisa delimitada por hairlines oro → se lee "estante de destinos",
    // no párrafo del cuerpo.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    paddingVertical: 16,
  },
  invite: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroSoft,
    marginLeft: 2,
  },
  rail: { gap: 10, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  chipNormal: {
    backgroundColor: colors.magentaTint,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
  },
  chipNormalPressed: { backgroundColor: colors.magentaTint2, transform: [{ scale: 0.97 }] },
  chipNormalText: { color: colors.leche },
  // Puerta-misterio: magenta sólido + glow, la única "encendida".
  chipMystery: { backgroundColor: colors.magenta, ...shadows.ctaMagenta },
  chipMysteryPressed: { backgroundColor: colors.magentaDeep, transform: [{ scale: 0.97 }] },
  chipMysteryText: { color: colors.blanco },
  chipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.2,
  },
})
