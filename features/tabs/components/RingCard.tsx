import { Pressable, StyleSheet, Text, View } from 'react-native'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { MacroRing } from './MacroRing'
import { SpeedometerRing } from './SpeedometerRing'

type Props = {
  label: string
  value: number
  /** Italic serif suffix, e.g. "/ 130 g", "kcal restantes". */
  unitSuffix: string
  /** Big number text, already formatted ("98", "1.5"). */
  formatted: string
  target: number
  ringColor?: string
  /** Smaller ring + number so the secondary card doesn't compete with the primary. */
  small?: boolean
  ringDelay?: number
  /** Budget mode (e.g. calories): `value` is the *remaining* amount,
   *  not the consumed amount. Ring starts full and depletes; the big
   *  number counts down. Disables the "empty translucent" treatment
   *  because value=0 here means "fully consumed", not "not started". */
  budget?: boolean
  /** Speedometer mode: a 270° gauge whose fill exceeds into the
   *  bottom 90° gap when `value > target`. `value` is the consumed
   *  amount (not remaining). Used by calories so going over is
   *  visible, not silently clamped. */
  speedometer?: boolean
  /** Overflow tint for speedometer mode — warm amber by default. */
  overColor?: string
  /** Línea honesta de "cuánto te falta/queda" bajo el subtítulo (p. ej.
   *  "Te faltan 73 g", "Te quedan 475 kcal"). null = no se muestra. UI font
   *  (no italic) para no invadir la voz del coach (italic = coach). */
  remainingText?: string | null
  /** Si se pasa, la tarjeta es tocable y abre el editor de la META. Muestra
   *  un "Ajustar ›" tenue como pista de que es editable. */
  onPress?: () => void
}

export function RingCard({
  label,
  value,
  unitSuffix,
  formatted,
  target,
  ringColor = colors.magenta,
  small = false,
  ringDelay = 200,
  budget = false,
  speedometer = false,
  overColor,
  remainingText,
  onPress,
}: Props) {
  const ringSize = small ? 76 : 88
  // Empty state: when nothing's been logged in an *accumulating* card,
  // the big "0" reads as failure rather than invitation. Match the
  // constellation's day-0 pattern — dim the number to translucent and
  // swap the unit suffix for a poetic prompt. Budget cards skip this
  // entirely: in budget mode, value=0 means "fully consumed" (real
  // info), and the full-budget state shows the target instead of 0.
  const isEmpty = !budget && value <= 0
  const Container = onPress ? Pressable : View
  return (
    <Container
      style={styles.column}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Toca para ajustar tu meta' : undefined}
    >
      <View style={styles.labelRow}>
        <EyebrowLabel tone="magenta" size={11} tracking={3}>
          {label}
        </EyebrowLabel>
        {onPress ? <Text style={styles.editHint}>Ajustar ›</Text> : null}
      </View>
      <View style={styles.row}>
        {speedometer ? (
          <SpeedometerRing
            value={value}
            target={target}
            size={ringSize}
            color={ringColor}
            overColor={overColor}
            delay={ringDelay}
          />
        ) : (
          <MacroRing
            value={value}
            target={target}
            size={ringSize}
            color={ringColor}
            delay={ringDelay}
          />
        )}
        <View style={styles.numberStack}>
          <Text
            style={[styles.value, small && styles.valueSmall, isEmpty && styles.valueEmpty]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {formatted}
          </Text>
          {/* La meta vive JUNTO al número ("62 / 135 g"), no separada abajo. */}
          <Text style={[styles.subtitle, isEmpty && styles.subtitleEmpty]}>
            {isEmpty ? 'todavía sin sumar' : unitSuffix}
          </Text>
        </View>
      </View>

      {/* Lo único abajo: el renglón honesto, CENTRADO y anclado al fondo
          (marginTop auto) para que quede alineado entre ambas tarjetas
          (misma altura por el stretch de la fila). En vacío no se muestra,
          para que el día cero sea invitación, no checklist. */}
      {remainingText && !isEmpty ? (
        <View style={styles.labelsBlock}>
          <Text style={styles.remaining}>{remainingText}</Text>
        </View>
      ) : null}
    </Container>
  )
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
    gap: 10,
    // Subtle card container anchors the macro as its own unit of info
    // (was previously floating against the page bg, competing with the
    // constellation hero above). Very low-alpha leche tint + hairline
    // bruma border give structure without adding visual weight.
    backgroundColor: 'rgba(244,236,222,0.035)',
    borderColor: colors.bruma,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  // Fila del eyebrow + pista "Ajustar ›" para enseñar que la meta es editable.
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  editHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  numberStack: {
    flexShrink: 1,
    minWidth: 0,
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 38,
    color: colors.leche,
    letterSpacing: -1.6,
    lineHeight: 38,
  },
  valueSmall: {
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -1.3,
  },
  valueEmpty: {
    opacity: 0.42,
  },
  // Renglón honesto, centrado y anclado al fondo (marginTop auto) para que
  // ambas tarjetas lo muestren a la misma altura.
  labelsBlock: {
    alignItems: 'center',
    width: '100%',
    marginTop: 'auto',
    paddingTop: 8,
  },
  // La meta — contexto suave (serif italic, bone), junto al número.
  subtitle: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.bone,
  },
  subtitleEmpty: {
    opacity: 0.72,
  },
  // "Te faltan X g" / "Te quedan X kcal" — el dato honesto que RESALTA: oro
  // cálido (no magenta/alerta, no leche que competiría con el número),
  // SemiBold, no italic (es dato, no voz de coach), centrado.
  remaining: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oro,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
})
