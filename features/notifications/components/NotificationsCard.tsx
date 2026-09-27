import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import type { NotificationWindow } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, radius, typography } from '@/theme'

import {
  applyNotificationWindow,
  type PermissionState,
  readNotificationPermission,
} from '../window'

/*
 * Avisos en Ajustes, en línea (dueña 26 sep 2026): prender, apagar o cambiar la
 * hora sin abrir otra pantalla. La pantalla de ventanas sigue en el onboarding,
 * donde prepara el permiso del sistema. Apagado = 'not_yet' (la misma
 * preferencia que "Aún no"); al prender vuelve a la última hora elegida.
 */

type RealWindow = Exclude<NotificationWindow, 'not_yet'>

const WINDOWS: { value: RealWindow; label: string }[] = [
  { value: 'morning', label: 'Mañana' },
  { value: 'midday', label: 'Mediodía' },
  { value: 'evening', label: 'Noche' },
]

export function NotificationsCard() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const saved = (profile?.notification_window as NotificationWindow | null) ?? null
  // Local para que el toque responda al instante; el perfil lo confirma después.
  const [current, setCurrent] = useState<NotificationWindow | null>(saved)
  const [lastReal, setLastReal] = useState<RealWindow>(
    saved && saved !== 'not_yet' ? saved : 'midday',
  )
  const [permission, setPermission] = useState<PermissionState>('unknown')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCurrent(saved)
    if (saved && saved !== 'not_yet') setLastReal(saved)
  }, [saved])

  useEffect(() => {
    void readNotificationPermission().then(setPermission)
  }, [])

  const on = current != null && current !== 'not_yet'

  const apply = async (next: NotificationWindow) => {
    if (busy) return
    Haptics.selectionAsync().catch(() => {})
    setCurrent(next)
    if (next !== 'not_yet') setLastReal(next)
    setBusy(true)
    try {
      const p = await applyNotificationWindow(next, {
        previous: saved,
        source: 'settings',
        save: (w) => updateProfile.mutateAsync({ notification_window: w }),
      })
      if (p !== 'unknown') setPermission(p)
    } catch {
      setCurrent(saved) // no se guardó: vuelve a lo que dice el perfil
    } finally {
      setBusy(false)
    }
  }

  const phoneOff = on && (permission === 'denied' || permission === 'blocked')

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>Avisos</Text>
          <Text style={styles.desc}>Nunca más de uno al día.</Text>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => void apply(v ? lastReal : 'not_yet')}
          trackColor={{ false: colors.bgCard2, true: colors.magenta }}
          thumbColor={colors.leche}
          ios_backgroundColor={colors.bgCard2}
          accessibilityLabel="Avisos"
        />
      </View>

      {on ? (
        <View style={styles.chips} accessibilityRole="radiogroup">
          {WINDOWS.map((w) => {
            const active = current === w.value
            return (
              <View key={w.value} style={styles.chipSlot}>
                <Pressable
                  onPress={() => (active ? undefined : void apply(w.value))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Avisos en la ${w.label.toLowerCase()}`}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <View style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {w.label}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )
          })}
        </View>
      ) : null}

      {phoneOff ? (
        <Pressable
          onPress={() =>
            permission === 'blocked' ? void Linking.openSettings() : void apply(lastReal)
          }
          accessibilityRole="button"
          accessibilityLabel="Activar los avisos en el teléfono"
          hitSlop={6}
        >
          <Text style={styles.warn}>
            {permission === 'blocked'
              ? 'Tu teléfono tiene los avisos de Stelar apagados. Actívalos en Ajustes ›'
              : 'Falta que tu teléfono los permita. Toca para permitirlos ›'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, gap: 3 },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  desc: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chipSlot: { flex: 1 },
  chip: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.bgCard2,
  },
  chipActive: { borderColor: colors.magenta, backgroundColor: colors.magentaTint2 },
  chipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  chipTextActive: { color: colors.magentaHot },
  pressed: { opacity: 0.75 },
  warn: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.oroSoft,
  },
})
