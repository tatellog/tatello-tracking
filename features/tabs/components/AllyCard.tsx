import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { mealPhotoUrl } from '@/features/macros/api'
import { colors, typography } from '@/theme'

const PHOTO = 40

export function BowlIcon({ color, size = 18 }: { color: string; size?: number }) {
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
  photoPath?: string | null
  /** true tras tocar "Repetir" — estampa la píldora un instante ("Sumada"). */
  confirmed?: boolean
  /** "Repetir" — re-registra la comida (1 tap). */
  onRepeat: () => void
  /** Separador superior (todas menos la primera fila). */
  divider?: boolean
}

/*
 * Una comida frecuente en el Tab Comidas (dirección de arte + ux sep 2026):
 * FILA, no card. Foto chica, nombre en leche, proteína en niebla y "Repetir"
 * como píldora fantasma (receta "control"; el magenta solo estampa al
 * confirmar). El cuerpo es INERTE a propósito: abrirlo editaba la comida
 * original de otro día y reescribía la historia sin avisar.
 */
export function AllyCard({
  name,
  protein,
  photoPath,
  confirmed = false,
  onRepeat,
  divider,
}: Props) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      {photoPath ? (
        <Image source={{ uri: mealPhotoUrl(photoPath) }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <BowlIcon color={colors.oroSoft} />
        </View>
      )}

      <View style={styles.textCol}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.protein}>{Math.round(protein)} g proteína</Text>
      </View>

      <Pressable
        style={[styles.repeat, confirmed && styles.repeatConfirmed]}
        onPress={onRepeat}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityLabel={confirmed ? `${name}, sumada` : `Repetir ${name}`}
      >
        <Text style={[styles.repeatText, confirmed && styles.repeatTextConfirmed]}>
          {confirmed ? 'Sumada' : 'Repetir'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
  },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lecheTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  protein: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.2,
    color: colors.niebla,
  },
  // Píldora fantasma con área táctil de 44 pt (minHeight 38 + hitSlop 6).
  repeat: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  repeatConfirmed: {
    borderColor: colors.magenta,
  },
  repeatText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  repeatTextConfirmed: {
    color: colors.magenta,
  },
})
