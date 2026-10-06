import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { StelarModal, StelarModalPanel } from '@/components/ui/StelarModal'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import { useStartWeekdayPlan } from '../hooks'
import { PLAN_TEXT_MAX, planOptionsForWeekday } from '../logic'
import { REMINDER_CHOICES, WEEKDAY_PLURAL, WEEKDAY_SINGULAR } from '../plan'

/*
 * Armar el plan de un día (dueña 6 oct 2026): "si es viernes, voy a X". Las
 * opciones salen de SUS días buenos de ese día (lo que estuvo cuando sí quedó
 * en déficit), o lo escribe ella. Stelar no receta: solo le muestra lo suyo.
 * 4 ocurrencias; al final el motor dice si se sostuvo. Dejarlo también está bien.
 */
export function WeekdayPlanSheet({
  visible,
  onClose,
  uid,
  hypothesisId,
  weekday,
}: {
  visible: boolean
  onClose: () => void
  uid: string | null
  hypothesisId: string
  weekday: number
}) {
  const plural = WEEKDAY_PLURAL[weekday] ?? 'días'
  const singular = WEEKDAY_SINGULAR[weekday] ?? 'ese día'
  const targets = useMacroTargets().data
  const history = useSignalsHistory(63).data ?? []
  const options = planOptionsForWeekday(
    history,
    weekday,
    { calorieTarget: targets?.calories ?? null, proteinTarget: targets?.protein_g ?? null },
    plural,
  )

  const [picked, setPicked] = useState<string | null>(null)
  const [own, setOwn] = useState('')
  const [writing, setWriting] = useState(false)
  const [reminder, setReminder] = useState<number | null>(13 * 60)
  const start = useStartWeekdayPlan(uid)

  const planText = (writing ? own : (picked ?? '')).trim()
  const canStart = planText.length > 0 && !start.isPending

  const begin = () => {
    if (!canStart) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    track('weekday_plan_started', { weekday, own: writing, reminder: reminder != null })
    start.mutate(
      { hypothesisId, weekday, planText, reminderMinutes: reminder },
      { onSuccess: onClose },
    )
  }

  return (
    <StelarModal
      visible={visible}
      onClose={onClose}
      kicker="Tu plan"
      kickerColor={colors.magenta}
      icon={
        <View style={styles.iconDisc}>
          <MaterialCommunityIcons name="calendar-check-outline" size={18} color={colors.magenta} />
        </View>
      }
      title={`Cuando sea ${singular}, voy a:`}
      footer={
        <View style={styles.footer}>
          <Pressable
            onPress={begin}
            disabled={!canStart}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primary,
              !canStart && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>
              {start.isPending ? 'Armando tu plan…' : 'Empezar mi plan'}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.secondary}>
            <Text style={styles.secondaryText}>Ahora no</Text>
          </Pressable>
        </View>
      }
    >
      <StelarModalPanel style={styles.panel}>
        {options.length > 0 ? (
          <Text style={styles.hint}>{`Lo que estuvo en tus ${plural} que sí salieron:`}</Text>
        ) : null}
        {options.map((o) => {
          const on = !writing && picked === o.text
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                setWriting(false)
                setPicked(o.text)
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.option, on && styles.optionOn]}
            >
              <MaterialCommunityIcons
                name={on ? 'radiobox-marked' : 'radiobox-blank'}
                size={18}
                color={on ? colors.magenta : colors.niebla}
              />
              <View style={styles.optionTexts}>
                <Text style={styles.optionText}>{o.text}</Text>
                <Text style={styles.optionEvidence}>{o.evidence}</Text>
              </View>
            </Pressable>
          )
        })}
        <Pressable
          onPress={() => setWriting(true)}
          accessibilityRole="radio"
          accessibilityState={{ selected: writing }}
          style={[styles.option, writing && styles.optionOn]}
        >
          <MaterialCommunityIcons
            name={writing ? 'radiobox-marked' : 'pencil-outline'}
            size={18}
            color={writing ? colors.magenta : colors.niebla}
          />
          <View style={styles.optionTexts}>
            {writing ? (
              <TextInput
                value={own}
                onChangeText={setOwn}
                autoFocus
                maxLength={PLAN_TEXT_MAX}
                placeholder="Ej. registrar la comida antes de salir"
                placeholderTextColor={colors.niebla}
                style={styles.input}
              />
            ) : (
              <Text style={styles.optionText}>Escribir el mío</Text>
            )}
          </View>
        </Pressable>
      </StelarModalPanel>

      <View style={styles.reminder}>
        <Text style={styles.reminderLabel}>{`¿Te lo recuerdo el ${singular}?`}</Text>
        <View style={styles.chips}>
          {REMINDER_CHOICES.map((c) => (
            <Chip
              key={c.minutes}
              label={c.label}
              on={reminder === c.minutes}
              onPress={() => setReminder(c.minutes)}
            />
          ))}
          <Chip label="No" on={reminder == null} onPress={() => setReminder(null)} />
        </View>
      </View>

      <Text style={styles.note}>
        {`Son 4 ${plural}. Al final te digo, con tus datos, si se sostuvo. Dejarlo también está bien.`}
      </Text>
      {start.isError ? (
        <Text style={styles.error}>No pudimos armar tu plan ahora. Intenta en un momento.</Text>
      ) : null}
    </StelarModal>
  )
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  iconDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magentaTint,
  },
  panel: { gap: 8 },
  hint: { fontFamily: typography.uiMedium, fontSize: typography.sizes.label, color: colors.bone },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  optionOn: { borderColor: colors.magenta, backgroundColor: colors.magentaTint },
  optionTexts: { flex: 1 },
  optionText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  optionEvidence: {
    marginTop: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  input: {
    padding: 0,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  reminder: { gap: 8 },
  reminderLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  chipOn: { borderColor: colors.magenta, backgroundColor: colors.magentaTint },
  chipText: { fontFamily: typography.uiSemi, fontSize: typography.sizes.label, color: colors.bone },
  chipTextOn: { color: colors.leche },
  note: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
  },
  error: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.magenta,
  },
  footer: { gap: 6, marginTop: 4 },
  primary: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.magenta,
  },
  primaryText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})
