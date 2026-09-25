import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { PrimaryCta } from '@/components/PrimaryCta'
import { useMarkWeeklyReadingOpened, useWeeklyReading } from '@/features/orbit/weekly-reading-hooks'
import { SkyBackground } from '@/features/tabs/components'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

/*
 * Tu lectura semanal (V-06) — la superficie del regalo del lunes: el motor
 * TE DEVUELVE gasto real + ritmo + una palanca, en beats cortos que se
 * revelan uno a uno (conversación breve, no reporte). 100% determinístico:
 * SIN sello ✦ (el ✦ es solo de la IA real, y aquí no hay IA).
 *
 * La lectura es de la última semana CERRADA y es inmutable; abrirla marca
 * opened_at (la métrica norte "Insights Opened per Week").
 */

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function rangeLabel(startIso: string, endIso: string): string {
  const d = (iso: string) => Number(iso.slice(8, 10))
  const m = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''
  return m(startIso) === m(endIso)
    ? `${d(startIso)} al ${d(endIso)} de ${m(endIso)}`
    : `${d(startIso)} de ${m(startIso)} al ${d(endIso)} de ${m(endIso)}`
}

export default function WeeklyReadingScreen() {
  const router = useRouter()
  const { data, isLoading, isError, refetch } = useWeeklyReading(true)
  const markOpened = useMarkWeeklyReadingOpened()
  const reading = data?.reading ?? null

  // Abrirla cuenta UNA vez (opened_at + huella TTFI). El guard evita
  // re-marcar en re-renders; la edge además solo escribe si estaba null.
  const openedOnce = useRef(false)
  useEffect(() => {
    if (!reading || openedOnce.current) return
    openedOnce.current = true
    track('insight_shown', { source: 'weekly_reading', tier: reading.grade })
    if (data?.openedAt == null) markOpened.mutate(reading.weekStart)
  }, [reading, data?.openedAt, markOpened])

  // Los beats se revelan uno a uno: opening → body → palanca → cierre.
  const beats: { key: string; kind: 'opening' | 'body' | 'lever' | 'closing'; text: string }[] =
    reading
      ? [
          { key: 'opening', kind: 'opening' as const, text: reading.opening },
          ...reading.body.map((text, i) => ({ key: `body-${i}`, kind: 'body' as const, text })),
          ...(reading.lever
            ? [{ key: 'lever', kind: 'lever' as const, text: reading.lever.text }]
            : []),
          { key: 'closing', kind: 'closing' as const, text: reading.closing },
        ]
      : []
  const [shown, setShown] = useState(1)
  const allShown = shown >= beats.length

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <EyebrowLabel tone="bone" size={10}>
              Tu lectura semanal
            </EyebrowLabel>
            {reading ? (
              <Text style={styles.range}>
                Semana del {rangeLabel(reading.weekStart, reading.weekEnd)}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <Text style={styles.stateBody}>Leyendo tu semana…</Text>
          ) : isError ? (
            <View style={styles.stateWrap}>
              <Text style={styles.stateBody}>Tu lectura no terminó de cargar.</Text>
              <Pressable onPress={() => void refetch()} hitSlop={10} accessibilityRole="button">
                <Text style={styles.retry}>Reintentar</Text>
              </Pressable>
            </View>
          ) : !reading ? (
            <View style={styles.stateWrap}>
              <Text style={styles.emptyTitle}>Esta semana aún no tiene lectura.</Text>
              <Text style={styles.stateBody}>
                Con unos días de comida registrada, tu próximo lunes trae la primera.
              </Text>
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(320)} style={styles.beats}>
              {beats.slice(0, shown).map((beat) => (
                <Animated.View
                  key={beat.key}
                  entering={FadeInUp.duration(420)}
                  style={[
                    styles.beat,
                    beat.kind === 'lever' && styles.beatLever,
                    beat.kind === 'closing' && styles.beatClosing,
                  ]}
                >
                  {beat.kind === 'lever' ? (
                    <EyebrowLabel tone="bone" size={9}>
                      Tu palanca para la semana que empieza
                    </EyebrowLabel>
                  ) : null}
                  <Text
                    style={
                      beat.kind === 'opening'
                        ? styles.opening
                        : beat.kind === 'closing'
                          ? styles.closing
                          : styles.body
                    }
                  >
                    {beat.text}
                  </Text>
                </Animated.View>
              ))}
            </Animated.View>
          )}
        </ScrollView>

        {reading ? (
          <View style={styles.footer}>
            <PrimaryCta
              label={allShown ? 'Volver a tu semana' : 'Seguir'}
              transform="none"
              onPress={() => {
                if (allShown) router.back()
                else setShown((n) => n + 1)
              }}
              accessibilityLabel={allShown ? 'Volver a tu semana' : 'Ver lo siguiente'}
            />
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  headerText: {
    gap: 6,
  },
  range: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  close: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    padding: 4,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  beats: {
    gap: 14,
  },
  beat: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  beatLever: {
    borderColor: colors.oroHairline,
  },
  beatClosing: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    alignItems: 'center',
  },
  opening: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 24,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 24,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  closing: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  stateWrap: {
    gap: 10,
    paddingTop: 24,
  },
  emptyTitle: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    color: colors.leche,
  },
  stateBody: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
  },
  retry: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
})
