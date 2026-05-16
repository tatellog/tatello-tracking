import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, typography } from '@/theme'

export type MealCardState = 'idle' | 'confirmed' | 'dimmed'

type Props = {
  name: string
  protein: number
  calories: number
  state?: MealCardState
  /** The "+" circle action — and the whole card when onCardPress is absent. */
  onPress: () => void
  /** When set, the card body becomes its own tap target (open editor);
   *  the circle keeps onPress. Without it the whole card runs onPress. */
  onCardPress?: () => void
  /** Lifts the card surface a step (bgCard2) — use when the card sits
   *  on a bgCard surface itself, e.g. inside the quick-log sheet. */
  elevated?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

const CIRCLE = 34

/* A frequent-meal card — name, macros and a "+" circle. Shared by the
 * Comidas estela and the quick-log sheet so the two never drift: the
 * estela wraps it with the constellation rail, the quick-log uses it
 * bare. On confirm the card stamps magenta. */
export function MealCard({
  name,
  protein,
  calories,
  state = 'idle',
  onPress,
  onCardPress,
  elevated = false,
  disabled = false,
  style,
}: Props) {
  const confirmed = state === 'confirmed'
  const cardStyle = [
    styles.card,
    elevated && styles.cardElevated,
    confirmed && styles.cardConfirmed,
  ]

  const content = (
    <>
      <Text style={[styles.name, confirmed && styles.textOnStamp]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.macros, confirmed && styles.textOnStamp]}>
        {Math.round(protein)} g · {calories} kcal
      </Text>
    </>
  )

  const icon = (
    <Text style={[styles.icon, confirmed && styles.iconConfirmed]}>{confirmed ? '✓' : '+'}</Text>
  )

  // Estela — card body and circle are independent tap targets.
  if (onCardPress) {
    return (
      <View style={[styles.row, state === 'dimmed' && styles.dimmed, style]}>
        <TouchableOpacity
          style={cardStyle}
          activeOpacity={0.6}
          onPress={onCardPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${name}`}
          accessibilityHint="Abre la comida en el editor"
        >
          {content}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circle, confirmed && styles.circleConfirmed]}
          activeOpacity={0.7}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Registrar ${name}`}
        >
          {icon}
        </TouchableOpacity>
      </View>
    )
  }

  // Quick-log — the whole card is one add tap target.
  return (
    <TouchableOpacity
      style={[styles.row, state === 'dimmed' && styles.dimmed, style]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Sumar ${name}`}
    >
      <View style={cardStyle}>{content}</View>
      <View style={[styles.circle, confirmed && styles.circleConfirmed]}>{icon}</View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  dimmed: {
    opacity: 0.32,
  },
  // The tappable surface — rounded card; a hairline edge + soft shadow
  // lift it off the screen. Stamps magenta on confirm.
  card: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 9,
    paddingHorizontal: 13,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  // One surface step up — for cards sitting on a bgCard surface.
  cardElevated: {
    backgroundColor: colors.bgCard2,
  },
  cardConfirmed: {
    backgroundColor: colors.magenta,
  },
  name: {
    fontFamily: typography.displaySemi,
    fontSize: 17,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  macros: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    color: colors.niebla,
  },
  textOnStamp: {
    color: '#FFFFFF',
  },
  // Quiet ghost circle — neutral ring, magenta glyph; goes solid white
  // only on confirm, against the stamped magenta card.
  circle: {
    alignSelf: 'center',
    marginLeft: 10,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleConfirmed: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  icon: {
    fontFamily: typography.uiBold,
    fontSize: 18,
    lineHeight: 20,
    color: colors.magenta,
  },
  iconConfirmed: {
    fontSize: 15,
    lineHeight: 17,
  },
})
