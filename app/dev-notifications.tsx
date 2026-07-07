import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { withDevGuard } from '@/components/withDevGuard'
import {
  CLOSE_COPY,
  cycleCopy,
  INVITE_COPY,
  PATTERN_COPY,
  RETURN_COPY,
  SEAL_COPY,
} from '@/features/notifications/invite'
import {
  CHANNEL_ANNOUNCEMENTS,
  CHANNEL_INVITATIONS,
  ensureChannels,
  type NotificationTarget,
} from '@/features/notifications/scheduler'
import { useProfile } from '@/features/profile/hooks'
import { SkyBackground } from '@/features/tabs/components'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

/*
 * Dev-only — dispara cada push del catálogo (N1..N6) on-demand para QA,
 * SIN pasar por los schedulers reales (ni sus gates ni arbitrajes: usa ids
 * `dev-test-*` para no pisar los slots agendados de verdad). Lo que SÍ es
 * real: el copy (mismas constantes que los schedulers), el `data.target`
 * (tocar el banner prueba el deep-link), el canal Android y el
 * interruptionLevel de iOS de cada slot.
 *
 * La preview simula el banner del OS (chrome: ícono + STELAR + ahora;
 * title 1 línea, body 2) para que el truncado se VEA aquí antes de sonar.
 * Los contadores marcan los límites del banner compacto (~40 title /
 * ~70 body) y se encienden en error al pasarse. El toggle "signo largo"
 * previsualiza N5 con Capricornio, el peor caso de longitud.
 *
 * Cómo ver el banner real: la app NO define setNotificationHandler, así
 * que en foreground el OS no pinta nada (comportamiento real del canal).
 * Programa el aviso y cierra la app o bloquea el teléfono: llega a ~5 s.
 *
 * En Expo Go no existe el módulo nativo (mismo guard que scheduler.ts):
 * la pantalla lo dice y desactiva los botones.
 */

const isExpoGo = Constants.executionEnvironment === 'storeClient'

/** Segundos hasta el disparo de una prueba individual — suficiente para
 *  cerrar la app o bloquear el teléfono. */
const FIRE_DELAY_S = 5
/** Separación entre avisos al probar todos en fila. */
const STAGGER_S = 7

/** Límites del banner compacto del OS (aprox, iOS/Android). */
const TITLE_MAX = 40
const BODY_MAX = 70

type Slot = {
  id: string
  eyebrow: string
  trigger: string
  title: string
  body: string
  target: NotificationTarget
  channelId: string
  /** iOS: las invitaciones llegan sin encender pantalla ni sonar. */
  passive?: boolean
}

export default withDevGuard(DevNotifications)

function DevNotifications() {
  const { data: profile } = useProfile()
  const sign = zodiacFromDate(profile?.date_of_birth)
  const realSignLabel = ZODIAC[sign].label

  // Peor caso de longitud para N5 — el bug de truncado solo aparece con
  // signos largos, y el signo real de la dueña puede ser corto.
  const [longSign, setLongSign] = useState(false)
  const signLabel = longSign ? 'CAPRICORNIO' : realSignLabel
  const cycle = cycleCopy(signLabel, new Date())

  const [status, setStatus] = useState<string | null>(null)

  // El catálogo completo, en el orden de prioridad del arbitraje. El copy
  // sale de las MISMAS constantes que usan los schedulers, así lo que ves
  // aquí es exactamente lo que sonaría.
  const slots: Slot[] = [
    {
      id: 'cycle',
      eyebrow: 'N5 · Ciclo mensual sellado',
      trigger: 'Día 1 del mes siguiente, solo si la figura del mes se completó.',
      title: cycle.title,
      body: cycle.body,
      target: 'orbit-mes',
      channelId: CHANNEL_ANNOUNCEMENTS,
    },
    {
      id: 'pattern',
      eyebrow: 'N3 · Patrón encontrado',
      trigger: 'Mañana en tu ventana, cuando un patrón quedó sin verse.',
      title: PATTERN_COPY.title,
      body: PATTERN_COPY.body,
      target: 'hoy',
      channelId: CHANNEL_ANNOUNCEMENTS,
    },
    {
      id: 'seal',
      eyebrow: 'N4 · Sello del lunes',
      trigger: 'Lunes en tu ventana, solo con datos de la semana.',
      title: SEAL_COPY.title,
      body: SEAL_COPY.body,
      target: 'orbit-semana',
      channelId: CHANNEL_ANNOUNCEMENTS,
    },
    {
      id: 'close',
      eyebrow: 'N1 · Cierre del día',
      trigger: 'Hoy 20:15, solo si registraste comida.',
      title: CLOSE_COPY.title,
      body: CLOSE_COPY.body,
      target: 'hoy',
      channelId: CHANNEL_ANNOUNCEMENTS,
    },
    {
      id: 'invite',
      eyebrow: 'N2 · Tu siguiente estrella',
      trigger: 'Mañana en tu ventana, solo si pausaste más de un día. Silenciosa.',
      title: INVITE_COPY.title,
      body: INVITE_COPY.body,
      target: 'hoy',
      channelId: CHANNEL_INVITATIONS,
      passive: true,
    },
    {
      id: 'return',
      eyebrow: 'N6 · Regreso a 7 días',
      trigger: 'A los 7 días de pausa. Silenciosa. Después, silencio total.',
      title: RETURN_COPY.title,
      body: RETURN_COPY.body,
      target: 'hoy',
      channelId: CHANNEL_INVITATIONS,
      passive: true,
    },
  ]

  const ensurePermission = async (
    Notifications: typeof import('expo-notifications'),
  ): Promise<boolean> => {
    const settings = await Notifications.getPermissionsAsync()
    if (settings.status === 'granted') return true
    if (!settings.canAskAgain) {
      setStatus('El OS tiene los avisos bloqueados para Stelar. Actívalos en Ajustes del teléfono.')
      return false
    }
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    })
    if (result.status !== 'granted') {
      setStatus('Permiso denegado: el OS no va a mostrar ninguna prueba.')
      return false
    }
    return true
  }

  const fire = async (slot: Slot, delaySeconds: number): Promise<void> => {
    const Notifications = await import('expo-notifications')
    await Notifications.scheduleNotificationAsync({
      identifier: `dev-test-${slot.id}`,
      content: {
        title: slot.title,
        body: slot.body,
        data: { target: slot.target },
        ...(slot.passive ? { interruptionLevel: 'passive' as const } : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
        repeats: false,
        channelId: slot.channelId,
      },
    })
  }

  const testOne = async (slot: Slot) => {
    if (isExpoGo) return
    try {
      const Notifications = await import('expo-notifications')
      if (!(await ensurePermission(Notifications))) return
      await ensureChannels(Notifications)
      await fire(slot, FIRE_DELAY_S)
      setStatus(`✓ ${slot.eyebrow} programada. Cierra la app: llega en ${FIRE_DELAY_S} segundos.`)
    } catch (err) {
      setStatus(`No se pudo programar: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  const testAll = async () => {
    if (isExpoGo) return
    try {
      const Notifications = await import('expo-notifications')
      if (!(await ensurePermission(Notifications))) return
      await ensureChannels(Notifications)
      for (let i = 0; i < slots.length; i++) {
        await fire(slots[i]!, FIRE_DELAY_S + i * STAGGER_S)
      }
      setStatus(
        `✓ Las ${slots.length} programadas, una cada ${STAGGER_S} s. Cierra la app y ve llegar la fila.`,
      )
    } catch (err) {
      setStatus(`No se pudo programar: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Notificaciones' }} />
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DevBackButton />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Notificaciones · QA</Text>
          <Text style={styles.subtitle}>
            Copy real de cada push (N1..N6). La preview simula el banner del OS: title corta a 1
            línea, body a 2. Toca Probar y cierra la app: llega en unos segundos; tocar el banner
            prueba su deep-link.
          </Text>

          {isExpoGo ? (
            <View style={styles.warnCard}>
              <Text style={styles.warnText}>
                Expo Go no incluye el módulo de notificaciones. Prueba en un build de dispositivo
                (development o preview).
              </Text>
            </View>
          ) : null}

          {status ? <Text style={styles.status}>{status}</Text> : null}

          <Pressable
            onPress={() => void testAll()}
            disabled={isExpoGo}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.allButton,
              isExpoGo && styles.disabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.allButtonText}>✦ Probar todas en fila</Text>
          </Pressable>

          {/* Peor caso de longitud: N5 con Capricornio (11 letras). */}
          <View style={styles.longSignRow}>
            <Text style={styles.longSignLabel}>
              Simular signo largo en N5 (Capricornio, hoy: {titleCase(realSignLabel)})
            </Text>
            <Switch
              value={longSign}
              onValueChange={setLongSign}
              trackColor={{ false: colors.bgCard2, true: colors.magenta }}
              thumbColor={colors.leche}
              ios_backgroundColor={colors.bgCard2}
              accessibilityLabel="Simular signo largo en N5"
            />
          </View>

          {slots.map((slot) => (
            <View key={slot.id} style={styles.card}>
              <Text style={styles.eyebrow}>{slot.eyebrow}</Text>

              {/* Banner simulado: chrome del OS (ícono + app + ahora) y el
                  MISMO truncado del banner compacto (title 1 línea, body 2).
                  El bug de N5 ("...quedó ent…") se ve aquí, no en el device. */}
              <View style={styles.preview}>
                <View style={styles.previewHeader}>
                  <Image source={require('@/assets/icon.png')} style={styles.previewAppIcon} />
                  <Text style={styles.previewAppName}>STELAR</Text>
                  <Text style={styles.previewNow}>ahora</Text>
                </View>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {slot.title}
                </Text>
                <Text style={styles.previewBody} numberOfLines={2}>
                  {slot.body}
                </Text>
              </View>

              {/* Contadores contra el banner compacto — error al pasarse. */}
              <Text style={styles.counters}>
                <Text style={slot.title.length > TITLE_MAX ? styles.counterOver : undefined}>
                  title {slot.title.length}/{TITLE_MAX}
                </Text>
                {'   ·   '}
                <Text style={slot.body.length > BODY_MAX ? styles.counterOver : undefined}>
                  body {slot.body.length}/{BODY_MAX}
                </Text>
              </Text>

              <Text style={styles.trigger}>{slot.trigger}</Text>
              <Pressable
                onPress={() => void testOne(slot)}
                disabled={isExpoGo}
                accessibilityRole="button"
                accessibilityLabel={`Probar ${slot.eyebrow}`}
                style={({ pressed }) => [
                  styles.button,
                  isExpoGo && styles.disabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>Probar</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function titleCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
    marginTop: 4,
    marginBottom: 10,
  },
  warnCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.feedbackErrorHairline,
    backgroundColor: colors.feedbackErrorTint,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  warnText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.feedbackError,
  },
  status: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.oroVect,
    marginBottom: 10,
  },
  allButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 174, 111, 0.4)',
    backgroundColor: 'rgba(217, 174, 111, 0.06)',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  allButtonText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.6,
    color: colors.bone,
  },
  longSignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  longSignLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 16,
    color: colors.niebla,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  // El "banner": simulación de cómo el OS pinta el aviso (chrome + copy).
  preview: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: colors.bgCard2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  previewAppIcon: {
    width: 18,
    height: 18,
    borderRadius: 4.5,
  },
  previewAppName: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.8,
    color: colors.niebla,
  },
  previewNow: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.bruma,
  },
  previewTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  previewBody: {
    marginTop: 2,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.bone,
  },
  counters: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.bruma,
  },
  counterOver: {
    color: colors.feedbackError,
  },
  trigger: {
    marginTop: 6,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    lineHeight: 16,
    color: colors.niebla,
  },
  button: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    backgroundColor: colors.magentaTint2,
    paddingVertical: 8,
    paddingHorizontal: 22,
  },
  buttonText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.magenta,
  },
  buttonPressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
})
