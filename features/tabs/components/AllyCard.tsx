import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { mealPhotoUrl } from '@/features/macros/api'
import { colors, typography } from '@/theme'

const PHOTO = 50
const FRAME = PHOTO + 16

/* El medallón ornamentado de la foto: la imagen circular dentro de un marco de
 * oro con un anillo + una corona de perlas (beads) alrededor — la "medalla" de
 * la comida aliada. El #1 va en oro claro con un glow más marcado; los demás en
 * oro pleno. Reemplaza la estrella suelta por un marco como joya. */
function MealMedallion({ photoPath, rank }: { photoPath?: string | null; rank: number }) {
  const top = rank === 0
  const ringColor = top ? colors.oroLight : colors.oro
  const c = FRAME / 2
  const photoR = PHOTO / 2
  const ringR = photoR + 3
  const beadR = ringR + 4
  // Pocos puntitos, dispersos (no una corona densa). Ángulos asimétricos.
  const dots = [-72, 6, 78, 150, 214, 288]
  return (
    <View style={styles.medallion}>
      {photoPath ? (
        <Image source={{ uri: mealPhotoUrl(photoPath) }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <BowlIcon color={colors.oroSoft} />
        </View>
      )}
      <Svg width={FRAME} height={FRAME} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Aro DIFUMINADO: dos capas anchas de baja opacidad simulan el blur. */}
        <Circle
          cx={c}
          cy={c}
          r={ringR}
          stroke={ringColor}
          strokeWidth={top ? 7 : 6}
          opacity={top ? 0.13 : 0.09}
          fill="none"
        />
        <Circle
          cx={c}
          cy={c}
          r={ringR}
          stroke={ringColor}
          strokeWidth={3.5}
          opacity={0.12}
          fill="none"
        />
        {/* El aro fino, SUAVE (no una línea dura). */}
        <Circle
          cx={c}
          cy={c}
          r={ringR}
          stroke={ringColor}
          strokeWidth={1}
          opacity={top ? 0.6 : 0.42}
          fill="none"
        />
        {/* Pocos puntitos dorados sobre el aro — sutiles. */}
        {dots.map((deg) => {
          const a = (deg * Math.PI) / 180
          return (
            <Circle
              key={deg}
              cx={c + beadR * Math.cos(a)}
              cy={c + beadR * Math.sin(a)}
              r={1}
              fill={ringColor}
              opacity={0.75}
            />
          )
        })}
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
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.body}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${name}`}
        accessibilityHint="Abre la comida en el editor"
      >
        <MealMedallion photoPath={photoPath} rank={rank} />

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
    shadowColor: colors.sombra,
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
  // El medallón — la foto en su marco de oro con perlas.
  medallion: {
    width: FRAME,
    height: FRAME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
  },
  photoEmpty: {
    backgroundColor: colors.bgCard2,
    alignItems: 'center',
    justifyContent: 'center',
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
