import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { PrimaryCta } from '@/components/PrimaryCta'
import { UNIVERSE_ACCENT, UNIVERSE_ICON_PATH, tint } from '@/features/tabs/universe-visuals'
import { colors, spacing, typography } from '@/theme'

import {
  formatGlasses,
  glassesWord,
  type DetectedLiquid,
  type LiquidDetection,
} from '../liquid-detection'

/*
 * El momento "Stelar entendió lo que tomé": al guardar una comida con
 * líquidos, esta hoja MUESTRA lo detectado y deja aceptar / editar / no
 * contar. Nunca suma en silencio (manifiesto: acompaña, no impone). Copy
 * cálido, sin culpa, sin lenguaje clínico, sin em-dash.
 *
 * Patrón de hoja: Modal + backdrop (FadeIn) + sheet (SlideInDown), igual
 * que QuickLogSheet (este repo no usa @gorhom/bottom-sheet).
 */

const WATER = UNIVERSE_ACCENT.claridad

export type LiquidAcceptPayload = {
  items: DetectedLiquid[]
  totalGlasses: number
  /** ¿La usuaria ajustó alguna cantidad antes de aceptar? (tracking) */
  edited: boolean
}

type Props = {
  visible: boolean
  detection: LiquidDetection
  /** Total de agua de hoy ANTES de esta comida (directa + otras comidas). */
  currentGlasses: number
  onAccept: (payload: LiquidAcceptPayload) => void
  onReject: () => void
}

// El selector de edición por líquido — pasos finos 0..1 + el valor detectado
// si excede 1 vaso (p. ej. 2 vasos de agua), para no forzar a reducirlo.
const FINE_STEPS = [0, 0.25, 0.5, 0.75, 1] as const
function stepsFor(detected: number): number[] {
  return detected > 1 ? [...FINE_STEPS, detected] : [...FINE_STEPS]
}

function Droplet({ size = 20, color = WATER }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={UNIVERSE_ICON_PATH.claridad}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function LiquidDetectionSheet({
  visible,
  detection,
  currentGlasses,
  onAccept,
  onReject,
}: Props) {
  const [mode, setMode] = useState<'review' | 'edit'>('review')
  // Cantidad por líquido (editable). Se siembra desde la detección al abrir.
  const [amounts, setAmounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!visible) return
    setMode('review')
    setAmounts(Object.fromEntries(detection.items.map((i) => [i.id, i.glasses])))
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }, [visible, detection])

  const lowConfidence = detection.confidence === 'low'

  const selectedTotal = useMemo(
    () =>
      Math.round(detection.items.reduce((s, i) => s + (amounts[i.id] ?? i.glasses), 0) / 0.25) *
      0.25,
    [amounts, detection.items],
  )
  const edited = useMemo(
    () => detection.items.some((i) => (amounts[i.id] ?? i.glasses) !== i.glasses),
    [amounts, detection.items],
  )

  const afterGlasses = Math.round((currentGlasses + selectedTotal) / 0.25) * 0.25

  const handleAccept = () => {
    const items = detection.items
      .map((i) => ({ ...i, glasses: amounts[i.id] ?? i.glasses }))
      .filter((i) => i.glasses > 0)
    onAccept({ items, totalGlasses: selectedTotal, edited })
  }

  const setAmount = (id: string, value: number) => {
    Haptics.selectionAsync().catch(() => {})
    setAmounts((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onReject}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(160)}
        style={styles.backdrop}
      >
        {/* Tocar fuera = no contar (decisión explícita, nada cambia en silencio). */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onReject}
          accessibilityLabel="Cerrar sin contar"
        />
      </Animated.View>

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(280)}
          exiting={SlideOutDown.duration(220)}
          style={styles.sheet}
        >
          <View style={styles.grabber} />

          <View style={styles.headerRow}>
            <Droplet />
            <Text style={styles.title}>
              {lowConfidence ? 'Posibles líquidos en tu comida' : 'Líquidos detectados'}
            </Text>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {detection.items.map((item) => {
              const value = amounts[item.id] ?? item.glasses
              return (
                <View key={item.id} style={styles.itemBlock}>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {mode === 'review' ? (
                      <Text style={styles.itemAmount}>
                        +{formatGlasses(value)} {glassesWord(value)}
                      </Text>
                    ) : null}
                  </View>

                  {mode === 'edit' ? (
                    <View style={styles.steps}>
                      {stepsFor(item.glasses).map((step) => {
                        const on = value === step
                        return (
                          <Pressable
                            key={step}
                            onPress={() => setAmount(item.id, step)}
                            style={[styles.step, on && styles.stepOn]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`${item.label}: ${formatGlasses(step)} ${glassesWord(step)}`}
                          >
                            <Text style={[styles.stepText, on && styles.stepTextOn]}>
                              {formatGlasses(step)}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  ) : null}
                </View>
              )
            })}
          </ScrollView>

          <View style={styles.divider} />

          {/* Agua de hoy: N → N (el cambio que la usuaria está por aceptar). */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Agua de hoy</Text>
            <Text style={styles.totalValue}>
              {formatGlasses(currentGlasses)}
              <Text style={styles.totalArrow}> → </Text>
              <Text style={{ color: WATER }}>{formatGlasses(afterGlasses)}</Text>
              <Text style={styles.totalUnit}> {glassesWord(afterGlasses)}</Text>
            </Text>
          </View>

          <Text style={styles.note}>También pueden contar como tu agua del día.</Text>

          <PrimaryCta
            label="Aceptar"
            onPress={handleAccept}
            marginTop={spacing.s4}
            accessibilityLabel="Sumar estos líquidos a tu agua"
          />
          <View style={styles.secondaryRow}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {})
                setMode((m) => (m === 'edit' ? 'review' : 'edit'))
              }}
              style={styles.secondaryBtn}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>{mode === 'edit' ? 'Listo' : 'Editar'}</Text>
            </Pressable>
            <Pressable onPress={onReject} style={styles.secondaryBtn} accessibilityRole="button">
              <Text style={[styles.secondaryText, styles.rejectText]}>No contar</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bruma,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    marginBottom: spacing.s3,
  },
  title: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
  },
  list: {
    maxHeight: 220,
  },
  itemBlock: {
    paddingVertical: spacing.s2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s3,
  },
  itemLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  itemAmount: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: WATER,
    fontVariant: ['tabular-nums'],
  },
  steps: {
    flexDirection: 'row',
    gap: spacing.s2,
    marginTop: spacing.s2,
  },
  step: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    backgroundColor: colors.bgCard2,
  },
  stepOn: {
    borderColor: WATER,
    backgroundColor: tint(WATER, '1F'),
  },
  stepText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  stepTextOn: {
    color: WATER,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.s3,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  totalValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  totalArrow: {
    color: colors.niebla,
  },
  totalUnit: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  note: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    marginTop: spacing.s2,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.s3,
    marginTop: spacing.s2,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  rejectText: {
    color: colors.niebla,
  },
})
