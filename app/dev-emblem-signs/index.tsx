import { useRouter } from 'expo-router'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { SkyBackground } from '@/features/tabs/components'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { ZODIAC } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

/*
 * Dev-only — índice de signos. Cada fila es un signo con su emblema
 * completo (100 %) de miniatura; al tocarlo se abre el detalle con todos
 * los porcentajes de ese signo (/dev-emblem-signs/<sign>).
 *
 * Route: /dev-emblem-signs
 */

const SIGNS: ZodiacSign[] = [
  'aries',
  'tauro',
  'geminis',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'escorpio',
  'sagitario',
  'capricornio',
  'acuario',
  'piscis',
]

const THUMB = 68

export default function DevEmblemSignsList() {
  const router = useRouter()
  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DevBackButton />
        <View style={styles.header}>
          <Text style={styles.title}>Signos por porcentaje</Text>
          <Text style={styles.subtitle}>Toca un signo para ver su reveal completo</Text>
        </View>
        <FlatList
          data={SIGNS}
          keyExtractor={(s) => s}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/dev-emblem-signs/${item}`)}
              accessibilityRole="button"
              accessibilityLabel={`${ZODIAC[item].label}, ver todos los porcentajes`}
            >
              <View style={styles.thumb}>
                <RevealedEmblem sign={item} transformProgress={100} size={THUMB} />
              </View>
              <Text style={styles.label}>{ZODIAC[item].label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
        />
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    overflow: 'hidden',
  },
  label: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: typography.letterSpacing.bodyLoose,
    color: colors.oroLeche,
  },
  chevron: {
    fontFamily: typography.ui,
    fontSize: 24,
    color: colors.niebla,
    marginRight: 8,
  },
})
