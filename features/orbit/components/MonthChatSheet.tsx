import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTransformProgress } from '@/features/emblem'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import { SkyBackground } from '@/features/tabs/components'
import type { ZodiacSign } from '@/features/tabs/zodiac'
import { useSession } from '@/hooks/useSession'
import { aiEnabledForEmail } from '@/lib/featureFlags'
import { colors, radius, typography } from '@/theme'

import type { Finding } from '../findings'
import { DiscoveryWave } from './DiscoveryWave'
import { FindingChatView } from './FindingChatView'
import { FindingView } from './FindingView'
import { StelarStar } from './MonthChatView'

/** Transición IA (~500ms) SOLO la 1ª vez de la sesión, saltable con un tap
 *  (uxui: por-hallazgo cansa; ya hay 2 momentos de "pensar"). Flag de módulo. */
let seenTransition = false

/*
 * La "sala" de Órbita Mes IA — el sheet full-screen donde vive UNA conversación
 * de tema, con foco (uxui + product: la conversación no compite con el
 * calendario del mes). Modal slide-up (como los DayLogModal de Órbita Día),
 * subido de nivel tras el mockup de la dueña:
 *   · grabber + cerrar DESLIZANDO hacia abajo (gesto natural del sheet),
 *   · eco de la constelación del mes al fondo (ambiente, "sigo en mi cielo"),
 *   · avatar por burbuja + "analizando tus patrones…" (viven en MonthChatView).
 * Sin timestamps (simulan mensajería en vivo · contra el manifiesto).
 * El botón cerrar es hijo absoluto directo del sheet (patrón conocido del repo).
 */

const CLOSE_DRAG = 120 // px arrastrados para descartar
const CLOSE_VELOCITY = 900 // o velocidad de flick

type Props = {
  /** El hallazgo a abrir (de una tarjeta); null = cerrado. */
  finding: Finding | null
  title: string
  sign: ZodiacSign | null
  /** Periodo + hash de hallazgos: para el chat guiado con IA (cache por hash). */
  periodStart: string
  periodEnd: string
  findingsHash: string
  /** Solo el hero de la sesión hace la metacognición (no se repite por card). */
  askMetacognition: boolean
  /** ¿Quedan hallazgos sin ver? (decide "otro hallazgo" vs "ver mi mes"). */
  hasMore: boolean
  onSaveReflection: (questionKey: string, answer: string) => void
  onNext: () => void
  onClose: () => void
  onPickDay?: (date: string) => void
}

export function MonthChatSheet({
  finding,
  title,
  sign,
  periodStart,
  periodEnd,
  findingsHash,
  askMetacognition,
  hasMore,
  onSaveReflection,
  onNext,
  onClose,
  onPickDay,
}: Props) {
  const insets = useSafeAreaInsets()
  const { progress } = useTransformProgress()
  const { session } = useSession()
  const aiOn = aiEnabledForEmail(session?.user?.email)
  const open = finding != null
  const translateY = useSharedValue(0)

  // Transición IA breve solo la 1ª vez de la sesión, saltable.
  const [transitioning, setTransitioning] = useState(false)
  useEffect(() => {
    if (!open) return
    translateY.value = 0
    if (seenTransition) return
    setTransitioning(true)
    seenTransition = true
    const id = setTimeout(() => setTransitioning(false), 500)
    return () => clearTimeout(id)
  }, [open, finding?.id, translateY])

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY)
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DRAG || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(onClose)()
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <SkyBackground />
          {/* Eco de la constelación del mes al fondo — ambiente, sin tocar. */}
          {sign ? (
            <View pointerEvents="none" style={[styles.echo, { top: insets.top + 40 }]}>
              <RevealedEmblem
                sign={sign}
                transformProgress={progress}
                size={220}
                masterOpacity={0.14}
                frameOpacity={0.5}
                glyphOpacity={0.4}
                bloomMaxOpacity={0}
              />
            </View>
          ) : null}

          {/* Grabber — arrastra hacia abajo para cerrar. */}
          <GestureDetector gesture={pan}>
            <View style={[styles.grabZone, { paddingTop: insets.top + 8 }]}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>

          {/* Cerrar — hijo absoluto directo del sheet. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={12}
            style={[styles.close, { top: insets.top + 10 }]}
          >
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>

          {finding && transitioning ? (
            <Pressable
              onPress={() => setTransitioning(false)}
              style={[styles.transition, { paddingTop: insets.top + 80 }]}
            >
              <DiscoveryWave width={200} />
              <Text style={styles.transitionText}>Encontrando conexiones…</Text>
            </Pressable>
          ) : null}

          {finding && !transitioning ? (
            <ScrollView
              contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Cabecera fija: título + quién lee. */}
              <View style={styles.head}>
                <StelarStar size={30} />
                <View style={styles.headText}>
                  <Text style={styles.headTopic}>{title}</Text>
                  <Text style={styles.headWho}>Stelar · leyendo tu mes</Text>
                </View>
              </View>

              {aiOn ? (
                <FindingChatView
                  key={finding.id}
                  finding={finding}
                  periodStart={periodStart}
                  periodEnd={periodEnd}
                  findingsHash={findingsHash}
                  askMetacognition={askMetacognition}
                  hasMore={hasMore}
                  onSaveReflection={onSaveReflection}
                  onNext={onNext}
                  onFinish={onClose}
                  onPickDay={onPickDay}
                />
              ) : (
                <FindingView
                  finding={finding}
                  onSaveReflection={onSaveReflection}
                  onNext={onNext}
                  onPickDay={onPickDay}
                />
              )}
            </ScrollView>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  echo: { position: 'absolute', right: -40, alignItems: 'center', justifyContent: 'center' },
  grabZone: { alignItems: 'center', paddingBottom: 8 },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.oroHairline,
  },
  close: {
    position: 'absolute',
    right: 18,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
  },
  closeGlyph: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroSoft,
  },
  content: { paddingHorizontal: 22, paddingTop: 6, gap: 22 },
  transition: { flex: 1, alignItems: 'center', gap: 20 },
  transitionText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.oroSoft,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1 },
  headTopic: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  headWho: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.6,
    color: colors.niebla,
    marginTop: 2,
  },
})
