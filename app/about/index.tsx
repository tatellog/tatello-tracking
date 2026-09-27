import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ChevronHint } from '@/components/ui/interaction'
import { SkyBackground } from '@/features/tabs/components'
import { colors, radius, typography } from '@/theme'

/*
 * "Acerca de Stelar" — el índice de la documentación del producto. Antes eran
 * cuatro filas sueltas en Ajustes (dueña 26 sep 2026: Ajustes solo para lo que
 * se ajusta); aquí viven juntas, con Novedades en lugar de la fila "Versión".
 */

const DOCS: { slug: string; label: string; caption: string }[] = [
  { slug: 'how-it-works', label: 'Cómo funciona Stelar', caption: 'La idea detrás de tu cielo.' },
  { slug: 'orbit', label: 'Cómo funciona Descubre', caption: 'Cómo encuentra tus patrones.' },
  { slug: 'faq', label: 'Preguntas frecuentes', caption: 'Lo que más nos preguntan.' },
  { slug: 'changelog', label: 'Novedades', caption: 'Stelar · v1.0.0' },
]

export default function AboutIndexScreen() {
  return (
    <ErrorBoundary screen="acerca">
      <AboutIndexBody />
    </ErrorBoundary>
  )
}

function AboutIndexBody() {
  const router = useRouter()
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
          <Text style={styles.title}>Acerca de Stelar</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {DOCS.map((d, i) => (
              <Pressable
                key={d.slug}
                onPress={() => router.push(`/about/${d.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={`${d.label}. ${d.caption}`}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <View style={[styles.row, i < DOCS.length - 1 && styles.rowDivider]}>
                  <View style={styles.rowText}>
                    <Text style={styles.label}>{d.label}</Text>
                    <Text style={styles.caption}>{d.caption}</Text>
                  </View>
                  <ChevronHint direction="right" size={16} color={colors.niebla} />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.leche,
    letterSpacing: 0.2,
  },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  rowText: { flex: 1, gap: 3 },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  caption: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  pressed: { opacity: 0.75 },
})
