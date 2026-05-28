import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg'

import { useBriefContext } from '@/features/brief/hooks'
import { StepHeader, useCountUp, WizardLayout } from '@/features/onboarding/components'
import { useProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

/*
 * Optional intermediate step between weight and tu-ciclo. Only
 * surfaces when we have BOTH height and weight; otherwise auto-
 * advances silently — no point holding the user on a screen that
 * has nothing to compute.
 *
 * The intent is *feedback* not *judgement*: the user just told us a
 * sensitive number; Stelar reflects it back as a single derived
 * value (BMI) and a soft category label that never uses the words
 * "obesity" or "overweight". The closing beat — cosmic body + "Tu
 * base está lista" — links this screen to cuerpo-base and weight so
 * the three baseline screens read as one continuous "Stelar te lee"
 * arc.
 */
const ACTIVITY_RANGES = [
  { max: 18.5, label: 'BAJO DEL RANGO', tone: 'soft' as const },
  { max: 24.9, label: 'EN TU RANGO', tone: 'magenta' as const },
  { max: 29.9, label: 'SOBRE TU RANGO', tone: 'soft' as const },
  { max: Infinity, label: 'LEJOS DE TU RANGO', tone: 'soft' as const },
]

export default function TuBaseScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { data: brief } = useBriefContext()
  const [auto, setAuto] = useState(false)
  const [showHow, setShowHow] = useState(false)

  const heightCm = profile?.height_cm ?? null
  const weightKg = brief?.latest_measurement?.weight_kg ?? null

  const bmi = useMemo(() => {
    if (heightCm == null || weightKg == null) return null
    const meters = heightCm / 100
    if (meters <= 0) return null
    return weightKg / (meters * meters)
  }, [heightCm, weightKg])

  useEffect(() => {
    if (bmi == null && !auto) {
      setAuto(true)
      router.replace('/onboarding/tu-ciclo')
    }
  }, [bmi, auto, router])

  const targetText = bmi != null ? bmi.toFixed(1) : '0.0'
  const counter = useCountUp(targetText, {
    duration: 1200,
    startDelay: 320,
    decimals: 1,
  })

  const range = useMemo(() => {
    if (bmi == null) return null
    return ACTIVITY_RANGES.find((r) => bmi <= r.max) ?? ACTIVITY_RANGES[ACTIVITY_RANGES.length - 1]!
  }, [bmi])

  if (bmi == null || range == null) {
    return <View style={styles.skipPad} />
  }

  return (
    <WizardLayout
      step={7}
      totalSteps={12}
      canContinue
      onContinue={() => router.push('/onboarding/tu-ciclo')}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <StepHeader eyebrow="Tu base" eyebrowColor="magenta" question="" />

        {/* Hero BMI value. Same cream halo as the height + weight
            heroes so the three baseline screens carry one luminous
            vocabulary. */}
        <View style={styles.numberBlock}>
          <Text style={styles.number}>{counter}</Text>
          <Text style={styles.unit}>BMI</Text>
        </View>

        {/* Range pill — small status dot lets the user *see* their
            position at a glance: magenta = in range, niebla = off
            range. No green/red — we don't judge. */}
        <View
          style={[styles.tagWrap, range.tone === 'magenta' ? styles.tagMagenta : styles.tagSoft]}
        >
          <View
            style={[
              styles.tagDot,
              range.tone === 'magenta' ? styles.tagDotMagenta : styles.tagDotSoft,
            ]}
          />
          <Text
            style={[
              styles.tagText,
              range.tone === 'magenta' ? styles.tagTextMag : styles.tagTextSoft,
            ]}
          >
            {range.label}
          </Text>
        </View>

        <Text style={styles.body}>
          Es tu punto de salida. Stelar lo guarda y no te lo va a mencionar todos los días.
        </Text>

        <Text style={styles.howLink} onPress={() => setShowHow(true)} suppressHighlighting>
          Cómo se calcula esto
        </Text>

        <View style={styles.rule} />

        {/* Ingredients — the two inputs Stelar used, surfaced as a
            tiny formula so the BMI doesn't feel like a number out of
            nowhere. */}
        <View style={styles.formulaBlock}>
          <View style={styles.formulaRow}>
            <Text style={styles.formulaLabel}>Tu peso</Text>
            <Text style={styles.formulaSep}>·</Text>
            <Text style={styles.formulaValue}>{weightKg!.toFixed(1)} kg</Text>
          </View>
          <View style={styles.formulaRow}>
            <Text style={styles.formulaLabel}>Tu altura</Text>
            <Text style={styles.formulaSep}>·</Text>
            <Text style={styles.formulaValue}>{heightCm} cm</Text>
          </View>
        </View>

        {/* Cosmic anchor — closes the three-screen baseline arc with
            the same body language as cuerpo-base + weight. */}
        <BaseReadyBody />
      </ScrollView>

      <HowCalculatedSheet visible={showHow} onClose={() => setShowHow(false)} />
    </WizardLayout>
  )
}

/* ─────────────────────── Cosmic body ─────────────────────── */

/** Small luminous body + closing phrase. Always alive (breathes) and
 *  always lit on this screen — the act of arriving here means Stelar
 *  has the base. Same vocabulary as the cuerpo-base CalibrationPreview
 *  and the weight StartingPointBody so the three baseline screens
 *  read as one continuous "Stelar te lee" beat. */
function BaseReadyBody() {
  const breath = useSharedValue(0)
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath])

  // Subtle reveal on mount — the body fades in 600 ms after the BMI
  // count-up starts so it lands after the user has read the number.
  const mountIn = useSharedValue(0)
  useEffect(() => {
    const id = setTimeout(() => {
      mountIn.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    }, 900)
    return () => clearTimeout(id)
  }, [mountIn])

  const wrapStyle = useAnimatedStyle(() => ({ opacity: mountIn.value }))

  const bloomProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { r: 44 + b * 3, opacity: 0.78 + b * 0.08 }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { r: 5 + b * 0.3 }
  })
  const diagonalSpikes = useAnimatedProps(() => {
    'worklet'
    return { opacity: 0.4 }
  })
  const raysProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { opacity: 0.55 + b * 0.06 }
  })
  const dustProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { opacity: 0.7 + b * 0.1 }
  })

  const W = 160
  const H = 130
  const CX = W / 2
  const CY = H / 2

  const RAYS = [
    { angle: -1.5, length: 22 },
    { angle: -0.65, length: 17 },
    { angle: 0.2, length: 24 },
    { angle: 0.95, length: 19 },
    { angle: 1.6, length: 16 },
    { angle: 2.4, length: 23 },
    { angle: 3.1, length: 20 },
    { angle: -2.55, length: 18 },
  ]
  const DUST = [
    { dx: -42, dy: -28, r: 1.0 },
    { dx: 46, dy: -18, r: 1.3 },
    { dx: 38, dy: 32, r: 0.9 },
    { dx: -48, dy: 22, r: 1.1 },
    { dx: -16, dy: -40, r: 0.8 },
    { dx: 52, dy: 14, r: 0.7 },
  ]

  return (
    <Animated.View style={[styles.anchor, wrapStyle]}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="tubase-core" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="40%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
          <RadialGradient id="tubase-bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.6} />
            <Stop offset="40%" stopColor={colors.magenta} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <AnimatedCircle cx={CX} cy={CY} fill="url(#tubase-bloom)" animatedProps={bloomProps} />

        {RAYS.map((ray, i) => (
          <AnimatedLine
            key={`ray-${i}`}
            x1={CX}
            y1={CY}
            x2={CX + Math.cos(ray.angle) * ray.length}
            y2={CY + Math.sin(ray.angle) * ray.length}
            stroke="#FBD7E3"
            strokeWidth={0.5}
            strokeLinecap="round"
            animatedProps={raysProps}
          />
        ))}

        <AnimatedLine
          x1={CX - 12}
          y1={CY - 12}
          x2={CX + 12}
          y2={CY + 12}
          stroke="#FFFFFF"
          strokeWidth={0.6}
          strokeLinecap="round"
          animatedProps={diagonalSpikes}
        />
        <AnimatedLine
          x1={CX + 12}
          y1={CY - 12}
          x2={CX - 12}
          y2={CY + 12}
          stroke="#FFFFFF"
          strokeWidth={0.6}
          strokeLinecap="round"
          animatedProps={diagonalSpikes}
        />

        <AnimatedCircle cx={CX} cy={CY} fill="url(#tubase-core)" animatedProps={coreProps} />

        {DUST.map((d, i) => (
          <AnimatedCircle
            key={i}
            cx={CX + d.dx}
            cy={CY + d.dy}
            r={d.r}
            fill="#FBD7E3"
            animatedProps={dustProps}
          />
        ))}
      </Svg>
      <Text style={styles.anchorCopy}>Tu base está lista.</Text>
    </Animated.View>
  )
}

/* The "cómo se calcula" sheet — opens on the link tap below the BMI
 * tag. Names the formula, frames the number as orientation not
 * verdict, and points at where the user can change inputs later. */
function HowCalculatedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={sheetStyles.backdrop}>
        <Pressable style={sheetStyles.scrim} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={sheetStyles.sheet}>
          <View style={sheetStyles.grabber} />
          <ScrollView
            contentContainerStyle={sheetStyles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={sheetStyles.eyebrow}>Cómo se calcula</Text>
            <Text style={sheetStyles.title}>
              El BMI es <Text style={sheetStyles.titleEm}>una orientación</Text>, no un veredicto.
            </Text>

            <Text style={sheetStyles.section}>FÓRMULA</Text>
            <Text style={sheetStyles.body}>
              El BMI es tu peso (kg) dividido por tu altura al cuadrado (m²). Es una proporción, no
              mide grasa ni músculo. Una persona muy musculosa puede tener un BMI &quot;alto&quot;
              sin tener grasa extra.
            </Text>

            <Text style={sheetStyles.section}>QUÉ STELAR HACE CON ESTE NÚMERO</Text>
            <Text style={sheetStyles.body}>
              Lo guarda como uno más entre tus datos de base. Si más adelante registras peso de
              nuevo, podemos mostrarte cómo va cambiando. No te lo trae todos los días: no es lo que
              define tu progreso.
            </Text>

            <Text style={sheetStyles.section}>DÓNDE LO CAMBIO</Text>
            <Text style={sheetStyles.body}>
              Altura: Ajustes → Mi perfil. Peso: cuando lo registres de nuevo en Progreso (track
              corporal).
            </Text>
          </ScrollView>
          <Pressable style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnLabel}>Cerrar</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  skipPad: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  numberBlock: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 10,
  },
  // Cream halo against the dark cosmic backdrop — depth without
  // bloom that competes with the magenta accents. Matches the
  // height (58 px) and weight (40 px) heroes in the prior two
  // baseline screens.
  number: {
    fontFamily: typography.displayHeavy,
    fontSize: 96,
    lineHeight: 96,
    color: colors.leche,
    letterSpacing: -3,
    includeFontPadding: false,
    textShadowColor: 'rgba(252, 246, 235, 0.22)',
    textShadowRadius: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  unit: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.magenta,
  },
  /* Range pill with leading status dot. */
  tagWrap: {
    marginTop: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 11,
    paddingRight: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    gap: 8,
  },
  tagMagenta: {
    backgroundColor: colors.magentaTint,
    borderColor: colors.magenta,
  },
  tagSoft: {
    backgroundColor: colors.bgCard,
    borderColor: colors.bruma,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagDotMagenta: {
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  tagDotSoft: {
    backgroundColor: colors.niebla,
  },
  tagText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  tagTextMag: {
    color: colors.magenta,
  },
  tagTextSoft: {
    color: colors.niebla,
  },
  body: {
    marginTop: 22,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    lineHeight: 22,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  howLink: {
    marginTop: 14,
    alignSelf: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.magenta,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingVertical: 6,
    textDecorationLine: 'underline',
  },
  rule: {
    marginTop: 18,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  /* Formula block — 2 rows showing the inputs Stelar used. Reads as
     a tiny "ingredients" list so the BMI doesn't feel like a number
     from nowhere. */
  formulaBlock: {
    marginTop: 16,
    alignSelf: 'center',
    gap: 6,
  },
  formulaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  formulaLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    minWidth: 70,
  },
  formulaSep: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
  },
  formulaValue: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.bone,
    letterSpacing: -0.2,
  },
  /* Cosmic anchor at the bottom — closes the baseline arc. */
  anchor: {
    marginTop: 28,
    alignItems: 'center',
    gap: 4,
    paddingBottom: 16,
  },
  anchorCopy: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
    letterSpacing: 0.1,
    marginTop: 4,
  },
})

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.bruma,
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bruma,
    marginTop: 10,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displaySm,
    lineHeight: 30,
    color: colors.leche,
    letterSpacing: -0.6,
  },
  titleEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
  section: {
    marginTop: 22,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
  closeBtn: {
    marginHorizontal: 22,
    marginBottom: 8,
    backgroundColor: colors.magenta,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    letterSpacing: 0.3,
  },
})
