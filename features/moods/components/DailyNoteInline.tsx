import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { colors, typography } from '@/theme'

import { useDailyNote, useUpsertDailyNote } from '../hooks'

/*
 * DailyNoteInline — la nota libre del check-in de "Cómo amaneciste". Reemplaza
 * el detalle de energía/motivación/calma. Una nota por día (daily_notes).
 * Guarda con debounce mientras escribes (por si el pager se lleva la slide antes
 * del blur) y también al salir del foco. Vacía = borra.
 */

const SAVE_DEBOUNCE_MS = 800

export function DailyNoteInline({ date }: { date: string }) {
  const { data: saved, isLoading } = useDailyNote(date)
  const upsert = useUpsertDailyNote(date)

  // Borrador local; se siembra una vez con lo guardado de ESE día.
  const [text, setText] = useState<string | null>(null)
  const [seededDate, setSeededDate] = useState<string | null>(null)
  useEffect(() => {
    if (isLoading || seededDate === date) return
    setText(saved ?? '')
    setSeededDate(date)
  }, [isLoading, saved, date, seededDate])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  const value = text ?? ''
  const dirty = seededDate === date && value !== (saved ?? '')

  const save = (): void => {
    if (timer.current) clearTimeout(timer.current)
    if (value === (saved ?? '')) return
    upsert.mutate(value)
  }
  const onChange = (t: string): void => {
    setText(t)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (t !== (saved ?? '')) upsert.mutate(t)
    }, SAVE_DEBOUNCE_MS)
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={save}
        multiline
        maxLength={2000}
        placeholder="¿Algo que quieras recordar de hoy? Escríbelo aquí."
        placeholderTextColor={colors.niebla}
        style={styles.input}
        textAlignVertical="top"
        accessibilityLabel="Nota de cómo amaneciste"
      />
      <Text style={styles.status}>
        {upsert.isPending ? 'Guardando…' : dirty ? ' ' : saved ? 'Nota guardada' : ' '}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
  },
  input: {
    minHeight: 76,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.bgCard2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 22,
    color: colors.leche,
  },
  status: {
    marginTop: 8,
    marginLeft: 2,
    minHeight: 16,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
