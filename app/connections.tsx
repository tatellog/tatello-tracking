import { Feather } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { StarLoader } from '@/components/StarLoader'
import { SkyBackground } from '@/features/tabs/components'
import { HealthConnectHero } from '@/features/wearables/components/HealthConnectHero'
import { useAppleHealthConnection } from '@/features/wearables/hooks'
import { colors, radius, typography } from '@/theme'

/*
 * Conexiones — el hogar canónico del wearable en Ajustes (spec §5): estado,
 * último sync, conectar/desconectar en un toque. El priming vive AQUÍ, antes
 * del prompt del OS (lección de notificaciones): qué lee, qué NO hace,
 * reversible. Desconectar deja de leer; lo ya anotado se queda (es de ella).
 *
 * Estados honestos:
 *   · available=false → "disponible en iPhone" (Expo Go / Android): sin
 *     botón muerto, sin promesa rota.
 *   · conectado sin datos → iOS no distingue permiso denegado de "sin
 *     datos": la línea de vacío guía a Salud sin culpar (spec §4).
 */

export default function ConnectionsScreen() {
  return (
    <ErrorBoundary screen="conexiones">
      <ConnectionsBody />
    </ErrorBoundary>
  )
}

function ConnectionsBody() {
  const router = useRouter()
  const { available, connected, lastSyncAt, busy, connect, disconnect } = useAppleHealthConnection()
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setError(null)
    const ok = await connect()
    if (!ok) {
      setError('No pudimos abrir la conexión ahora. Intenta de nuevo en un momento.')
    }
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.back}
          >
            <Feather name="chevron-left" size={24} color={colors.leche} />
          </Pressable>
          <Text style={styles.title}>Conexiones</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <HealthConnectHero />
          </View>

          <Text style={styles.promise}>
            Tu reloj anota por ti. <Text style={styles.promiseStrong}>Nada sale de tu cuenta.</Text>
          </Text>

          {/* ── Apple Health ── */}
          <Text style={styles.eyebrow}>Apple Health</Text>
          <View style={styles.card}>
            {available === false ? (
              <Text style={styles.body}>
                {Platform.OS === 'ios' && Constants.executionEnvironment === 'storeClient'
                  ? // Solo lo ve la dueña en desarrollo: Expo Go no incluye el
                    // módulo de Salud; el prompt real vive en el dev build.
                    'Expo Go no incluye Salud. En el build de desarrollo, este botón abre la hoja de permisos.'
                  : 'Disponible en iPhone. Cuando abras Stelar desde uno, aquí podrás conectar tu reloj.'}
              </Text>
            ) : connected ? (
              <>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotOn} />
                  <Text style={styles.statusLabel}>Conectado</Text>
                </View>
                {lastSyncAt ? (
                  <Text style={styles.metaLine}>Última lectura: {syncLabel(lastSyncAt)}</Text>
                ) : (
                  <Text style={styles.metaLine}>
                    Aún no encontramos registros tuyos. Si tu reloj ya guarda entrenos o sueño, dale
                    un vistazo al permiso en Salud → Stelar.
                  </Text>
                )}
                <Pressable
                  onPress={() => void disconnect()}
                  accessibilityRole="button"
                  accessibilityLabel="Desconectar Apple Health"
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryBtnText}>Desconectar</Text>
                </Pressable>
                <Text style={styles.footnote}>
                  Al desconectar, Stelar deja de leer tu reloj. Lo que ya se anotó se queda contigo.
                </Text>
              </>
            ) : (
              <>
                {/* El priming — qué lee, qué NO hace, reversible. */}
                <View style={styles.point}>
                  <Text style={styles.pointGlyph}>✦</Text>
                  <Text style={styles.pointText}>
                    Tus entrenos se anotan solos, calorías incluidas.
                  </Text>
                </View>
                <View style={styles.point}>
                  <Text style={styles.pointGlyph}>✦</Text>
                  <Text style={styles.pointText}>Tu sueño llega cada mañana, sin escribir.</Text>
                </View>
                <View style={styles.point}>
                  <Text style={styles.pointGlyph}>✦</Text>
                  <Text style={styles.pointText}>No te vigila. Solo te ahorra escribir.</Text>
                </View>
                <Pressable
                  onPress={() => void handleConnect()}
                  disabled={busy || available !== true}
                  accessibilityRole="button"
                  accessibilityLabel="Conectar Apple Health"
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (busy || available !== true) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {busy ? (
                    <StarLoader size={16} color={colors.leche} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Conectar Apple Health</Text>
                  )}
                </Pressable>
                <Text style={styles.footnote}>
                  Al conectar, tu teléfono te preguntará qué puede leer Stelar. Puedes desconectarlo
                  cuando quieras.
                </Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </>
            )}
          </View>

          {/* ── Garmin — por rebote hoy, directo después (spec fase 3). ── */}
          <Text style={styles.eyebrow}>Garmin</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              ¿Usas Garmin? Activa Apple Health en tu app Garmin Connect y tus entrenos y tu sueño
              llegan a Stelar. La conexión directa con Garmin llega después.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

/** "hoy, 14:32" / "3 jul, 09:10" — sin relojes relativos que envejecen mal. */
function syncLabel(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const sameDay = new Date().toDateString() === d.toDateString()
  if (sameDay) return `hoy, ${time}`
  const day = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  return `${day}, ${time}`
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: { width: 40, alignItems: 'flex-start' },
  title: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  hero: { marginTop: 18, marginBottom: 18 },
  promise: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
    textAlign: 'center',
    marginBottom: 26,
    paddingHorizontal: 12,
  },
  promiseStrong: {
    fontFamily: typography.serifSemi,
    color: colors.leche,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bruma,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 22,
  },
  body: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
  },
  point: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  pointGlyph: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.oroVect,
    lineHeight: 20,
  },
  pointText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusDotOn: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.oroLight,
  },
  statusLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  metaLine: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  primaryBtn: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  primaryBtnText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    letterSpacing: 0.3,
    color: colors.leche,
  },
  secondaryBtn: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  secondaryBtnText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  footnote: {
    marginTop: 10,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
  },
  error: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.feedbackError,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
})
