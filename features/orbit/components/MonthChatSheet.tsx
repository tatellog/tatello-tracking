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
import { colors, radius, typography } from '@/theme'

import type { Finding } from '../findings'
import { FindingView } from './FindingView'
import { StelarStar } from './MonthChatView'
import { StelarOrb } from './StelarOrb'

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
  onSaveReflection: (questionKey: string, answer: string) => void
  onNext: () => void
  onClose: () => void
}

export function MonthChatSheet({ finding, title, sign, onSaveReflection, onNext, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const { progress } = useTransformProgress()
  const open = finding != null
  const translateY = useSharedValue(0)

  // Momento "Leyendo tu mes…": al abrir, el orbe de polvo estelar recorre tu
  // mes ~2.4s antes de revelar el hallazgo (mientras el backend ya lo tiene).
  const [reading, setReading] = useState(false)
  useEffect(() => {
    if (!open) return
    setReading(true)
    const id = setTimeout(() => setReading(false), 2400)
    return () => clearTimeout(id)
  }, [open, finding?.id])

  // Al abrir, arranca asentado (la animación de entrada la da el Modal).
  useEffect(() => {
    if (open) translateY.value = 0
  }, [open, translateY])

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

          {finding ? (
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

              {reading ? (
                <View style={styles.reading}>
                  <StelarOrb size={168} />
                  <Text style={styles.readingText}>Leyendo tu mes…</Text>
                  <Text style={styles.readingSub}>
                    Buscando patrones que normalmente pasarían desapercibidos.
                  </Text>
                </View>
              ) : (
                <FindingView
                  finding={finding}
                  onSaveReflection={onSaveReflection}
                  onNext={onNext}
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
  reading: { alignItems: 'center', justifyContent: 'center', paddingTop: 36, gap: 12 },
  readingText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.oroSoft,
    marginTop: 6,
  },
  readingSub: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    textAlign: 'center',
    paddingHorizontal: 30,
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
