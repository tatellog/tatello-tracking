import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { AtmosphericSky, StepHeader, WizardLayout } from '@/features/onboarding/components'
import { HealthConnectHero } from '@/features/wearables/components/HealthConnectHero'
import { useAppleHealthConnection } from '@/features/wearables/hooks'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

/*
 * Paso 11b — conexión con el reloj (decisión de la dueña, jul 2026: además
 * de Ajustes, el onboarding invita a conectar — referencia visual YAZIO,
 * traducida a voz Stelar: sin "¡78%!", sin "like magic!", sin checkmarks
 * verdes de vendedor).
 *
 * PRIMING (misma lección que el paso 11 de notificaciones): la pantalla
 * nombra qué lee, qué NO hace y que es reversible ANTES de disparar el
 * prompt del OS. El prompt solo se quema si ella toca "Conectar"; "Ahora
 * no" es una preferencia legítima (la conexión espera en Ajustes →
 * Conexiones, sin re-asks).
 *
 * DISPONIBILIDAD honesta: en Android o Expo Go no existe HealthKit — el
 * paso muestra la nota de "disponible en iPhone" y el CTA es solo
 * "Continuar" (jamás un botón que promete y truena). No se auto-salta en
 * dev para poder diseñarlo en Expo Go; el flujo real lo salta solo porque
 * el CTA neutro avanza igual.
 *
 * El sync inicial (30 días) corre DENTRO de connect(); al volver del prompt
 * la usuaria sigue al siguiente paso sin esperar nada.
 */
export default function HealthConnectScreen() {
  const router = useRouter()
  const { available, busy, connect } = useAppleHealthConnection()
  const [connected, setConnected] = useState(false)

  const advance = () => router.push('/onboarding/attribution')

  const canConnect = available === true && !connected

  const handleContinue = async () => {
    if (!canConnect) {
      advance()
      return
    }
    // Conectar: prompt del OS + backfill inicial (dentro de connect()). Un
    // fallo no bloquea el wizard: avanza igual y el re-intento vive en
    // Ajustes → Conexiones.
    const ok = await connect()
    if (ok) {
      setConnected(true)
      track('onboarding_wearable_connected')
    } else {
      track('onboarding_wearable_connect_failed')
    }
    advance()
  }

  const handleSkip = () => {
    track('onboarding_wearable_skipped')
    advance()
  }

  return (
    <WizardLayout
      step={12}
      showProgress={false}
      showBack={false}
      canContinue
      loading={busy}
      onContinue={() => void handleContinue()}
      continueLabel={canConnect ? 'Conectar Apple Health' : 'Continuar'}
      ctaVariant="soft"
      ctaTransform="none"
      atmosphere={<AtmosphericSky glow={{ cx: '50%', cy: '38%', r: '70%' }} />}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow="Tu reloj"
          eyebrowColor="magenta"
          question="¿Entrenas con un reloj?"
          questionEmphasis="reloj"
          hint="Si usas Apple Watch o Garmin, Stelar puede anotar por ti."
        />

        <View style={styles.hero}>
          <HealthConnectHero />
        </View>

        {/* Qué gana — y la promesa de qué NO hace (la línea que separa
            sync de vigilancia; manifiesto). */}
        <View style={styles.points}>
          <View style={styles.point}>
            <Text style={styles.pointGlyph}>✦</Text>
            <Text style={styles.pointText}>Tus entrenos se anotan solos, calorías incluidas.</Text>
          </View>
          <View style={styles.point}>
            <Text style={styles.pointGlyph}>✦</Text>
            <Text style={styles.pointText}>Tu sueño llega cada mañana, sin escribir.</Text>
          </View>
          <View style={styles.point}>
            <Text style={styles.pointGlyph}>✦</Text>
            <Text style={styles.pointText}>No te vigila. Solo te ahorra escribir.</Text>
          </View>
        </View>

        {available === false ? (
          <Text style={styles.priming}>
            {Platform.OS === 'ios' && Constants.executionEnvironment === 'storeClient'
              ? 'Expo Go no incluye Salud. En el build de desarrollo, este paso abre la hoja de permisos.'
              : 'Disponible en iPhone. Podrás conectarlo cuando quieras desde Ajustes.'}
          </Text>
        ) : connected ? (
          <Text style={styles.connectedNote}>Conectado. Tu cielo ya está leyendo.</Text>
        ) : (
          <Text style={styles.priming}>
            Al conectar, tu teléfono te preguntará qué puede leer Stelar. Puedes desconectarlo
            cuando quieras.
          </Text>
        )}

        {canConnect ? (
          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Conectar después"
            hitSlop={10}
            style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
          >
            <Text style={styles.skipText}>Ahora no</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </WizardLayout>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 32,
    paddingBottom: 24,
  },
  hero: {
    marginTop: 34,
    marginBottom: 30,
  },
  points: {
    paddingHorizontal: 22,
    gap: 12,
  },
  point: {
    flexDirection: 'row',
    gap: 10,
  },
  pointGlyph: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroVect,
    lineHeight: 21,
  },
  pointText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
  },
  // Micro-copy de priming — utilitario (Hanken, no serif): desarma el prompt
  // del OS con honestidad, igual que el paso de notificaciones.
  priming: {
    marginTop: 26,
    paddingHorizontal: 22,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    lineHeight: 16,
    color: colors.niebla,
    textAlign: 'center',
  },
  connectedNote: {
    marginTop: 26,
    paddingHorizontal: 22,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    textAlign: 'center',
  },
  skip: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipPressed: { opacity: 0.6 },
  skipText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
})
