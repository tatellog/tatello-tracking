import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { StarLoader } from '@/components/StarLoader'
import { SkyBackground } from '@/features/tabs/components'
import {
  useLatestWearableWeight,
  useScaleBadge,
  useScaleConnection,
} from '@/features/wearables/hooks'
import { colors, radius, typography } from '@/theme'

/*
 * Tu báscula (spec wearables §9 · decisión dueña): el hogar del opt-in de peso
 * desde Salud. Se abre desde el ícono de la cabecera de Hoy (el punto avisa
 * que llegó una lectura nueva y se apaga aquí). Manifiesto: el peso NO vive en
 * Hoy — aquí la usuaria vino a propósito, así que la última lectura sí se
 * muestra, con su procedencia, y el camino sigue a Progreso.
 *
 * Reglas: opt-in explícito con priming (qué lee, qué NO hace, reversible) ·
 * manual gana, la báscula rellena · nunca "pésate hoy" · sin meta ni delta.
 */
export default function ScaleScreen() {
  return (
    <ErrorBoundary screen="bascula">
      <ScaleBody />
    </ErrorBoundary>
  )
}

function ScaleBody() {
  const router = useRouter()
  const { available, enabled, busy, enable, disable } = useScaleConnection()
  const latest = useLatestWearableWeight(enabled === true)
  const { markSeen } = useScaleBadge()
  const [error, setError] = useState<string | null>(null)

  // Abrir la pantalla = ver la lectura: el punto del ícono se apaga.
  useEffect(() => {
    if (latest.data) markSeen()
  }, [latest.data, markSeen])

  const handleEnable = async () => {
    setError(null)
    const ok = await enable()
    if (!ok) setError('No pudimos abrir el permiso ahora. Intenta de nuevo en un momento.')
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
          <Text style={styles.title}>Tu báscula</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.promise}>
            Te pesas cuando quieras.{' '}
            <Text style={styles.promiseStrong}>Stelar lo anota por ti.</Text>
          </Text>

          <View style={styles.card}>
            {available === false ? (
              <Text style={styles.body}>
                Disponible en iPhone con Apple Salud. Cuando abras Stelar desde uno, aquí podrás
                encender tu báscula.
              </Text>
            ) : enabled ? (
              <>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotOn} />
                  <Text style={styles.statusLabel}>Encendida</Text>
                </View>

                {latest.isLoading ? (
                  <StarLoader size={16} color={colors.niebla} />
                ) : latest.data ? (
                  <View style={styles.reading}>
                    <Text style={styles.readingEyebrow}>Última lectura</Text>
                    <Text style={styles.readingValue}>
                      {latest.data.weight_kg.toFixed(1)}
                      <Text style={styles.readingUnit}> kg</Text>
                    </Text>
                    <Text style={styles.metaLine}>
                      {readingLabel(latest.data.measured_at)} · desde tu báscula
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.metaLine}>
                    Aún no encontramos lecturas. Si tu báscula ya guarda tu peso en Salud, dale un
                    vistazo al permiso en Salud → Stelar.
                  </Text>
                )}

                <Pressable
                  onPress={() => router.push('/weight-trend')}
                  accessibilityRole="button"
                  accessibilityLabel="Ver tu tendencia en Progreso"
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryBtnText}>Ver tu tendencia</Text>
                </Pressable>
                <Pressable
                  onPress={() => void disable()}
                  accessibilityRole="button"
                  accessibilityLabel="Apagar la báscula"
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryBtnText}>Apagar</Text>
                </Pressable>
                <Text style={styles.footnote}>
                  Si un día registras tu peso a mano, ese manda. Al apagar, Stelar deja de leer la
                  báscula; lo ya anotado se queda contigo.
                </Text>
              </>
            ) : (
              <>
                {/* El priming — qué lee, qué NO hace, reversible (spec §5). */}
                <View style={styles.point}>
                  <Text style={styles.pointGlyph}>✦</Text>
                  <Text style={styles.pointText}>
                    Lee el peso que tu báscula guarda en Salud y lo suma a tu tendencia.
                  </Text>
                </View>
                <View style={styles.point}>
                  <Text style={styles.pointGlyph}>✦</Text>
                  <Text style={styles.pointText}>
                    No te lo muestra en Hoy ni te pide pesarte. Solo te ahorra escribirlo.
                  </Text>
                </View>
                <View style={styles.point}>
                  <Text style={styles.pointGlyph}>✦</Text>
                  <Text style={styles.pointText}>Se apaga en un toque, cuando quieras.</Text>
                </View>
                <Pressable
                  onPress={() => void handleEnable()}
                  disabled={busy || available !== true}
                  accessibilityRole="button"
                  accessibilityLabel="Encender tu báscula"
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (busy || available !== true) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {busy ? (
                    <StarLoader size={16} color={colors.leche} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Encender mi báscula</Text>
                  )}
                </Pressable>
                <Text style={styles.footnote}>
                  Tu teléfono te preguntará si Stelar puede leer tu peso. Solo lectura.
                </Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

/** "hoy, 07:12" / "3 jul, 09:10" — sin relojes relativos que envejecen mal. */
function readingLabel(iso: string): string {
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
  // Voz coach — la promesa, en serif italic.
  promise: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 24,
    color: colors.bone,
    marginTop: 18,
    marginBottom: 18,
  },
  promiseStrong: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
    gap: 12,
  },
  body: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pointGlyph: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    marginTop: 1,
  },
  pointText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDotOn: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.magenta },
  statusLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  reading: { gap: 2, marginTop: 4 },
  readingEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // Número en la tipografía de datos, grande pero sin dominar la pantalla.
  readingValue: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.gaugeNum,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  readingUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  metaLine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  primaryBtn: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: colors.magenta,
  },
  primaryBtnText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  secondaryBtnText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  footnote: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.niebla,
  },
  error: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
})
