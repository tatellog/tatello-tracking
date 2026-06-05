import type { StyleProp, ViewStyle } from 'react-native'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { mealPhotoUrl } from '@/features/macros/api'
import { colors, typography } from '@/theme'

export type MealCardState = 'idle' | 'confirmed' | 'dimmed'

// A bowl with a wisp of steam — the placeholder when a meal has no photo.
function BowlIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11 H21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M4.2 11 C 4.6 16.6 7.8 20 12 20 C 16.2 20 19.4 16.6 19.8 11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.4 4.6 c1.1 1.3 1.1 2 0 3.3 M14 4.6 c1.1 1.3 1.1 2 0 3.3"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}

type Props = {
  name: string
  protein: number
  calories: number
  /** Veces que la comida aparece en la estela (recurrencia). Se muestra
   *  solo si > 1 — una comida registrada una vez no es "repetida". */
  freq?: number
  /** Storage path de la foto del platillo. Si se pasa la prop (aunque sea
   *  null) se reserva el thumbnail; null → monograma. Sin la prop, no hay
   *  thumbnail (p.ej. el quick-log de Hoy). */
  photoPath?: string | null
  state?: MealCardState
  /** The "+" circle action — and the whole card when onCardPress is absent. */
  onPress: () => void
  /** When set, the card body becomes its own tap target (open editor);
   *  the circle keeps onPress. Without it the whole card runs onPress. */
  onCardPress?: () => void
  /** Lifts the card surface a step (bgCard2) — use when the card sits
   *  on a bgCard surface itself, e.g. inside the quick-log sheet. */
  elevated?: boolean
  /** Tighter row — smaller type, padding and circle. Use for long
   *  lists, e.g. "Lo de siempre" in the quick-log sheet. */
  compact?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

const CIRCLE = 34
const CIRCLE_COMPACT = 28

/* A frequent-meal card — a rounded surface holding the name + macros
 * and a "+" circle, all inside one card. Shared by the Comidas estela
 * and the quick-log sheet so the two never drift. On the estela the
 * body and the circle are separate tap targets (edit vs log); in the
 * quick-log the whole card logs. On confirm the card stamps magenta. */
export function MealCard({
  name,
  protein,
  calories,
  freq,
  photoPath,
  state = 'idle',
  onPress,
  onCardPress,
  elevated = false,
  compact = false,
  disabled = false,
  style,
}: Props) {
  const confirmed = state === 'confirmed'
  const cardSurface = [
    styles.card,
    compact && styles.cardCompact,
    elevated && styles.cardElevated,
    confirmed && styles.cardConfirmed,
    state === 'dimmed' && styles.dimmed,
    style,
  ]

  const content = (
    <>
      <Text
        style={[styles.name, compact && styles.nameCompact, confirmed && styles.textOnStamp]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        style={[styles.macros, compact && styles.macrosCompact, confirmed && styles.textOnStamp]}
      >
        {Math.round(protein)} g · {calories} kcal
        {freq != null && freq > 1 ? (
          <Text style={[styles.freq, confirmed && styles.textOnStamp]}>{`  ·  ${freq} veces`}</Text>
        ) : null}
      </Text>
    </>
  )

  const icon = (
    <Text style={[styles.icon, compact && styles.iconCompact, confirmed && styles.iconConfirmed]}>
      {confirmed ? '✓' : '+'}
    </Text>
  )

  // Dish thumbnail — only when the caller opts in (passes photoPath, even
  // null). The photo if there is one; otherwise a monogram so the row
  // keeps its alignment instead of leaving a hole.
  const thumb =
    photoPath !== undefined ? (
      photoPath ? (
        <Image source={{ uri: mealPhotoUrl(photoPath) }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <BowlIcon color={colors.niebla} />
        </View>
      )
    ) : null

  // Estela — one card surface, two tap targets inside it: the body
  // opens the editor, the "+" circle logs the meal.
  if (onCardPress) {
    return (
      <View style={cardSurface}>
        <TouchableOpacity
          style={styles.body}
          activeOpacity={0.6}
          onPress={onCardPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${name}`}
          accessibilityHint="Abre la comida en el editor"
        >
          {thumb}
          <View style={styles.bodyText}>{content}</View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.circle,
            compact && styles.circleCompact,
            confirmed && styles.circleConfirmed,
          ]}
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

  // Quick-log — the whole card is one add tap target; the "+" circle
  // inside it is the visual cue.
  return (
    <TouchableOpacity
      style={cardSurface}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Sumar ${name}`}
    >
      <View style={styles.body}>
        {thumb}
        <View style={styles.bodyText}>{content}</View>
      </View>
      <View
        style={[
          styles.circle,
          compact && styles.circleCompact,
          confirmed && styles.circleConfirmed,
        ]}
      >
        {icon}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  dimmed: {
    opacity: 0.32,
  },
  // The card surface — a rounded row holding the body + the "+"
  // circle. A hairline edge + soft shadow lift it off the screen;
  // it stamps magenta on confirm.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 10,
    paddingHorizontal: 13,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  // Compact — a tighter row for long frequent-meal lists.
  cardCompact: {
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  // The body — thumb + name/macros; on the estela it's the editor's target.
  body: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bodyText: {
    flex: 1,
    minWidth: 0,
  },
  // Dish thumbnail — circular. The plate's photo, or a bowl icon when
  // none, so the estela reads as a gallery of what you actually eat.
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  thumbEmpty: {
    backgroundColor: colors.bgCard2,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: typography.sizes.anchor,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  nameCompact: {
    fontSize: typography.sizes.ui,
  },
  macros: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    color: colors.niebla,
  },
  macrosCompact: {
    marginTop: 1,
    fontSize: typography.sizes.caption,
  },
  // Recurrencia — el dato que da sentido a la estela. Brilla un punto
  // más que los macros para leerse como la señal, no como ruido.
  freq: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  textOnStamp: {
    color: colors.leche,
  },
  // Quiet ghost circle — neutral ring, magenta glyph; goes solid white
  // only on confirm, against the stamped magenta card.
  circle: {
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
  circleCompact: {
    width: CIRCLE_COMPACT,
    height: CIRCLE_COMPACT,
    borderRadius: CIRCLE_COMPACT / 2,
  },
  circleConfirmed: {
    backgroundColor: colors.leche,
    borderColor: colors.leche,
  },
  icon: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.heading,
    lineHeight: 20,
    color: colors.magenta,
  },
  iconCompact: {
    fontSize: typography.sizes.title,
    lineHeight: 18,
  },
  iconConfirmed: {
    fontSize: typography.sizes.ui,
    lineHeight: 17,
  },
})
