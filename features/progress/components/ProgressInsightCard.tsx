import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { useRouter } from 'expo-router'

import { useFindingTranscript } from '@/features/orbit/chat-transcript'
import type { Finding } from '@/features/orbit/findings'
import { MonthChatSheet } from '@/features/orbit/components/MonthChatSheet'
import { StelarStar } from '@/features/orbit/components/MonthChatView'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { useSaveReflection } from '@/features/orbit/reflections'
import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'
import { aiEnabledForEmail, PROGRESS_CHAT_ENABLED } from '@/lib/featureFlags'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { PROGRESS_EVENTS } from '../constants'
import { useProgressInsights } from '../hooks'
import { insightToFinding } from '../insight-chat'
import { hashProgressInsights } from '../insights'

/*
 * Epic 04 · el insight principal de Progress como DESCUBRIMIENTO + conversación
 * guiada. Espejo de MonthDiscovery (Órbita Mes): lectura (voz del coach) +
 * evidencia + un CTA que abre el chat. Reutiliza TODO el chat de Órbita
 * (MonthChatSheet → FindingChatView: IA que solo explica, backstops, fallback
 * determinístico, transcript que rehidrata sin red) vía insightToFinding.
 *
 * Doble gate: PROGRESS_CHAT_ENABLED (flag) + aiEnabledForEmail (dev) — la beta
 * no ve nada de esto hasta validar. Se auto-oculta sin insights (silencio
 * honesto). El puente al PORQUÉ es Órbita (Epic 06), no este chat.
 */

/** Ventana del caché del chat: fechas reales (≠ monthKey de Órbita Mes → filas
 *  de ai_insights distintas, sin colisión de árbol de turnos). */
const CHAT_WINDOW_DAYS = 45

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d + days, 12)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function ProgressInsightCard() {
  const { session } = useSession()
  const aiOn = PROGRESS_CHAT_ENABLED && aiEnabledForEmail(session?.user?.email)
  const uid = session?.user?.id ?? null

  const state = useProgressInsights()
  const insights = useMemo(
    () => (state.status === 'completed' || state.status === 'partial' ? state.data : []),
    [state],
  )
  const main = insights[0] ?? null

  const finding = useMemo<Finding | null>(() => (main ? insightToFinding(main) : null), [main])
  const hash = useMemo(() => hashProgressInsights(insights), [insights])
  const [open, setOpen] = useState(false)

  // ¿Ya conversaste este insight (mismo hash)? → el CTA retoma, no invita.
  const { read } = useFindingTranscript(uid, main?.id ?? '', hash)
  const talked = main != null && read() != null

  const today = todayInTimezone()
  // Epic 05 · la respuesta de metacognición se persiste en month_reflections
  // (clave `progress:<insightId>`) — memoria para futuras conversaciones. No
  // modifica el insight (inmutable).
  const saveReflection = useSaveReflection(today.slice(0, 7))
  const router = useRouter()

  if (!aiOn || !main || !finding) return null
  const ctaLabel = talked ? 'Retomar con Stelar' : 'Hablémoslo con Stelar'
  // Epic 06 · el puente explícito al PORQUÉ: Progress muestra qué cambió; el
  // comportamiento que lo acompañó vive en Órbita. Un link, no un duplicado.
  const goOrbita = () => {
    track(PROGRESS_EVENTS.openOrbita, { from: 'insight', id: main.id })
    requestOrbitSegment('mes')
    router.push('/orbit')
  }

  return (
    <Animated.View entering={FadeIn.duration(360).delay(100)}>
      {/* Divisor propio: sin insight (o sin gate) la sección no existe. */}
      <View style={styles.divider} />
      <Text style={styles.eyebrow}>Estas semanas cambió algo</Text>
      <Text style={styles.lead}>{main.lead}</Text>
      <Text style={styles.support}>{main.support}</Text>

      <Pressable
        style={styles.cta}
        onPress={() => {
          track(PROGRESS_EVENTS.openInsight, { id: main.id })
          setOpen(true)
        }}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <StelarStar size={16} />
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </Pressable>

      {/* El puente al porqué — link callado, no otra card. */}
      <Pressable
        onPress={goOrbita}
        accessibilityRole="link"
        accessibilityLabel="Entender el porqué en Órbita"
        style={({ pressed }) => [styles.bridge, pressed && styles.bridgePressed]}
      >
        <Text style={styles.bridgeText}>El porqué vive en Órbita →</Text>
      </Pressable>

      <MonthChatSheet
        finding={open ? finding : null}
        title={main.subject.charAt(0).toUpperCase() + main.subject.slice(1)}
        subtitle="Stelar · leyendo tu progreso"
        closeLabel="Ver mi progreso"
        sign={null}
        periodStart={shiftIso(today, -CHAT_WINDOW_DAYS)}
        periodEnd={today}
        findingsHash={hash}
        askMetacognition
        hasMore={false}
        onSaveReflection={(questionKey, answer) => saveReflection.mutate({ questionKey, answer })}
        onNext={() => setOpen(false)}
        onClose={() => setOpen(false)}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 28 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 12,
  },
  lead: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 30,
    color: colors.leche,
  },
  support: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    marginTop: 20,
    backgroundColor: colors.magentaTint,
    borderWidth: 1.5,
    borderColor: colors.magentaGlow,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.magentaHot,
  },
  bridge: { marginTop: 12, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  bridgePressed: { opacity: 0.6 },
  bridgeText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
})
