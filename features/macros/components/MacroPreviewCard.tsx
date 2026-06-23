import { StyleSheet, Text, View } from 'react-native'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { FullMacros } from '@/features/profile/calcMacros'
import { colors, radius, spacing, typography } from '@/theme'

/*
 * "Vista previa de tus nuevos objetivos" — the three numbers the chosen
 * enfoque + nivel produce, recomputed live. Calorías leads with the
 * delta vs maintenance as context; protein + fat show their g/kg so the
 * math stays transparent (guide, not prescription). Optionally renders
 * carbs as a fourth column (breakdown screen uses it).
 */

type Props = {
  macros: FullMacros
  weightKg: number
  /** kcal vs TDEE — shown under Calorías ("-475 kcal"). null hides it. */
  delta?: number | null
  /** Eyebrow above the card. */
  title?: string
  /** Include carbohidratos as a fourth stat. */
  withCarbs?: boolean
}

function perKg(grams: number, weightKg: number): string {
  if (!weightKg) return ''
  return `${(grams / weightKg).toFixed(1)} g por kg`
}

function fmt(n: number): string {
  return n.toLocaleString('es-MX')
}

export function MacroPreviewCard({ macros, weightKg, delta, title, withCarbs }: Props) {
  const deltaText =
    delta == null || delta === 0 ? null : `${delta > 0 ? '+' : ''}${fmt(delta)} kcal`

  return (
    <View style={styles.wrap}>
      {title ? (
        <EyebrowLabel tone="niebla" size={10} tracking={2.4} style={styles.title}>
          {title}
        </EyebrowLabel>
      ) : null}
      <View style={styles.card}>
        <Stat label="Calorías" value={fmt(macros.calories)} sub={deltaText} />
        <View style={styles.divider} />
        <Stat
          label="Proteína"
          value={`${macros.protein_g} g`}
          sub={perKg(macros.protein_g, weightKg)}
        />
        <View style={styles.divider} />
        <Stat label="Grasa" value={`${macros.fat_g} g`} sub={perKg(macros.fat_g, weightKg)} />
        {withCarbs ? (
          <>
            <View style={styles.divider} />
            <Stat
              label="Carbos"
              value={`${macros.carbs_g} g`}
              sub={perKg(macros.carbs_g, weightKg)}
            />
          </>
        ) : null}
      </View>
    </View>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string | null }) {
  return (
    <View style={styles.stat}>
      <EyebrowLabel tone="magenta" size={9.5} tracking={1.8}>
        {label.toUpperCase()}
      </EyebrowLabel>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  title: {
    marginLeft: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 5,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.hairline,
  },
  value: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.displaySm,
    // lineHeight con holgura para el descendente de la "g" ("143 g"): sin él,
    // Android recorta la cola de la g (la caja de línea queda al ras del
    // fontSize). includeFontPadding lo deja respirar arriba y abajo.
    lineHeight: Math.round(typography.sizes.displaySm * 1.3),
    includeFontPadding: true,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  sub: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
  },
})
