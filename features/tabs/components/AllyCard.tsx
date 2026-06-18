import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { mealPhotoUrl } from '@/features/macros/api'
import { colors, typography } from '@/theme'

// Estrella de 4 puntas cóncava (lenguaje del sistema celeste).
const STAR_PATH =
  'M12 3 C12.7 8.3 13.7 9.3 21 12 C13.7 14.7 12.7 15.7 12 21 C11.3 15.7 10.3 14.7 3 12 C10.3 9.3 11.3 8.3 12 3 Z'

/* Estrella de rango (top 3 de tus aliados, por frecuencia). El podio se lee por
 * BRILLO en oro, no por metales: #1 grande y luminosa (con halo), #2 media, #3
 * chica. Lenguaje de constelación — tus mejores aliadas brillan más. */
function RankStar({ rank }: { rank: number }) {
  const top = rank === 0
  const size = top ? 19 : rank === 1 ? 15 : 12.5
  const color = top ? colors.oroLight : colors.oro
  const opacity = top ? 1 : rank === 1 ? 0.92 : 0.78
  return (
    <View style={[styles.rankStar, top && styles.rankStarTop]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={STAR_PATH} fill={color} opacity={opacity} />
      </Svg>
    </View>
  )
}

function BowlIcon({ color, size = 20 }: { color: string; size?: number }) {
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
  freq: number
  photoPath?: string | null
  /** 0-based ranking; 0..2 muestran medalla. */
  rank: number
  /** true tras tocar "Repetir" — estampa el botón un instante. */
  confirmed?: boolean
  /** "Repetir" — re-loggea la comida ahora (1 tap). */
  onRepeat: () => void
  /** Tap en el cuerpo — abre la comida en el editor. */
  onOpen: () => void
}

/*
 * AllyCard — una "comida aliada" en el Tab Comidas. A diferencia del MealCard
 * (compartido con el quick-log de Hoy), aquí la PROTEÍNA es el dato principal
 * (lo que impulsa la transformación) y la frecuencia es secundaria; el ranking
 * lleva medalla y el CTA es "Repetir" (registro en 1 tap).
 */
export function AllyCard({
  name,
  protein,
  freq,
  photoPath,
  rank,
  confirmed = false,
  onRepeat,
  onOpen,
}: Props) {
  const ranked = rank < 3

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.body}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${name}`}
        accessibilityHint="Abre la comida en el editor"
      >
        <View style={styles.thumbWrap}>
          {photoPath ? (
            <Image
              source={{ uri: mealPhotoUrl(photoPath) }}
              style={styles.thumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <BowlIcon color={colors.niebla} />
            </View>
          )}
          {ranked ? <RankStar rank={rank} /> : null}
        </View>

        <View style={styles.textCol}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.protein}>+{Math.round(protein)} g proteína</Text>
          <Text style={styles.freq}>
            {freq} {freq === 1 ? 'vez' : 'veces'}
          </Text>
        </View>
      </Pressable>

      <Pressable
        style={[styles.repeat, confirmed && styles.repeatConfirmed]}
        onPress={onRepeat}
        accessibilityRole="button"
        accessibilityLabel={`Repetir ${name}`}
      >
        <Text style={[styles.repeatText, confirmed && styles.repeatTextConfirmed]}>
          {confirmed ? '✓ Listo' : 'Repetir'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 10,
    paddingLeft: 11,
    paddingRight: 11,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  body: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbWrap: {
    width: 48,
    height: 48,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  thumbEmpty: {
    backgroundColor: colors.bgCard2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Estrella de rango — sobre la esquina del thumb (top 3). Sombra oscura
  // tenue para que el oro lea sobre cualquier foto.
  rankStar: {
    position: 'absolute',
    top: -7,
    left: -7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.bg,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 3,
  },
  // El #1 lleva un halo dorado tenue — "tu mejor aliada" sin gritar.
  rankStarTop: {
    shadowColor: colors.oro,
    shadowOpacity: 0.95,
    shadowRadius: 6,
    elevation: 4,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  // Proteína = el dato PRINCIPAL (lo que impulsa la transformación).
  protein: {
    marginTop: 3,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    letterSpacing: 0.2,
  },
  // Frecuencia = contexto secundario.
  freq: {
    marginTop: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
  // "Repetir" — el CTA de 1 tap. Pill magenta suave; estampa al confirmar.
  repeat: {
    marginLeft: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: colors.magentaTint,
    borderWidth: 1,
    borderColor: colors.magentaTint2,
  },
  repeatConfirmed: {
    backgroundColor: colors.magenta,
    borderColor: colors.magenta,
  },
  repeatText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  repeatTextConfirmed: {
    color: colors.leche,
  },
})
