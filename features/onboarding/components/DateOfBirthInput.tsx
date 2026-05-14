import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { createElement, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  /** Selected date, or null when the user hasn't picked yet. */
  value: Date | null
  onChange: (next: Date) => void
  /** Date shown by the picker until the user makes a choice. */
  defaultDate?: Date
  minDate?: Date
  maxDate?: Date
}

const SPANISH_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

function formatDateLong(d: Date): string {
  const month = SPANISH_MONTHS[d.getMonth()] ?? 'ene'
  return `${d.getDate()} ${month} ${d.getFullYear()}`
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DateOfBirthInput({ value, onChange, defaultDate, minDate, maxDate }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const seed = value ?? defaultDate ?? new Date(2000, 0, 1)

  const handleNativeChange = (_event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (next) onChange(next)
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>FECHA DE NACIMIENTO</Text>
        <WebDateInput
          value={value ? toISODate(value) : ''}
          min={minDate ? toISODate(minDate) : undefined}
          max={maxDate ? toISODate(maxDate) : undefined}
          onChange={(iso) => {
            const parsed = parseISODate(iso)
            if (parsed) onChange(parsed)
          }}
        />
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>FECHA DE NACIMIENTO</Text>
      <Pressable
        onPress={() => setShowPicker((prev) => !prev)}
        style={[styles.tapTarget, showPicker && styles.tapTargetActive]}
        accessibilityRole="button"
        accessibilityLabel="Elegir fecha de nacimiento"
      >
        <Text style={[styles.value, !value && styles.valuePlaceholder]}>
          {value ? formatDateLong(value) : 'Tocar para elegir'}
        </Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={seed}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={handleNativeChange}
          textColor={colors.leche}
          themeVariant="dark"
          style={styles.picker}
        />
      ) : null}
    </View>
  )
}

function parseISODate(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

// RNW renders TextInput as <input>, but for `type="date"` we bypass
// JSX (its DOM typings aren't in the RN types). createElement keeps
// the iOS/Android builds happy and the web build wired to the native
// date picker.
function WebDateInput({
  value,
  min,
  max,
  onChange,
}: {
  value: string
  min: string | undefined
  max: string | undefined
  onChange: (iso: string) => void
}) {
  return createElement('input', {
    type: 'date',
    value,
    min,
    max,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    style: {
      fontFamily: typography.uiBold,
      fontSize: 22,
      letterSpacing: -0.5,
      color: colors.leche,
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: `2px solid ${colors.bruma}`,
      padding: '10px 0',
      outline: 'none',
      width: '100%',
      colorScheme: 'dark',
    },
  })
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.niebla,
    letterSpacing: 2.2,
  },
  tapTarget: {
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.bruma,
  },
  tapTargetActive: {
    borderBottomColor: colors.magenta,
  },
  value: {
    fontFamily: typography.uiBold,
    fontSize: 22,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  valuePlaceholder: {
    color: colors.bruma,
  },
  picker: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
})
