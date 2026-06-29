import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import EmblemHalo from '@/assets/zodiac-art/emblem-halo-frame.svg'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { ChevronHint, usePressFeedback } from '@/components/ui/interaction'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { useProfile } from '@/features/profile/hooks'
import {
  FRAMES_BY_SIGN,
  frameIndexFor,
} from '@/features/tabs/components/constellation/RevealedEmblem'
import { signName, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, radius, spacing, typography } from '@/theme'

import { useTransformProgress } from '../hooks'
import { dailyCoachLine } from '../logic'

/* Emblema COMPACTO — el frame del % vigente (mismo arte que el hero y el modal
 * "Tu {signo}"), brillante, sobre el aro/halo. No es la constelación gigante:
 * es el símbolo legible del crecimiento. Sin Skia (RN <Image>), barato. */
function CompactEmblem({
  sign,
  progress,
  size,
}: {
  sign: ZodiacSign
  progress: number
  size: number
}) {
  const frames = FRAMES_BY_SIGN[sign]
  const frame = frames[frameIndexFor(progress)] ?? frames[frames.length - 1]
  // El halo crece con el avance: el emblema "gana luz" al transformarse.
  const haloOpacity = 0.32 + (Math.min(100, Math.max(0, progress)) / 100) * 0.55
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <EmblemHalo
        width={size}
        height={size}
        style={[styles.compactHalo, { opacity: haloOpacity }]}
      />
      <Image
        source={frame}
        style={{ width: size * 0.74, height: size * 0.74 }}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  )
}

/*
 * "Tu transformación" — la cara LEGIBLE del Emblema Celeste.
 *
 * El emblema se materializa arriba, en el hero; esta tarjeta dice QUÉ
 * está pasando: cuánto se reveló (porcentaje, decisión de producto
 * 2026-06-12), en qué etapa va, y — vía el ⓘ — cómo funciona el
 * sistema completo (dos sistemas, las reglas del universo).
 *
 * Dos variantes:
 *   · compact (Hoy)  — solo la VOZ: la línea del coach de la etapa, sin
 *     número ni barra. En Hoy el % sobre 100 leía como "meta" (loss-
 *     framing prohibido por el manifiesto) y la barra como un loader; el
 *     indicador de avance vive arriba, en el emblema del hero. Aquí solo
 *     queda la observación cálida. Tap → Órbita · Mes (decisión 2026-06-12,
 *     revertida en favor de la voz). La frase ROTA por día dentro de la
 *     etapa: una etapa dura ~2 semanas y la misma frase repetida se vuelve
 *     ruido.
 *   · full (Órbita)  — % grande + barra + mini emblema + explainer
 *     desplegable. Vive en el Mes: ahí el dato tiene contexto (la usuaria
 *     fue a entender, no a ser juzgada al pasar) y la transformación es el
 *     arco largo.
 *
 * Gates: solo Leo tiene emblema hoy (espejo de hasEmblem en
 * LunarConstellation) y la tarjeta no existe hasta el primer hábito
 * (progress 0 → null): el despertar se descubre, no se promete.
 *
 * Performance: estática — la barra se pinta del progreso actual sin
 * animación (cambia pocas veces al día vía React Query); la celebración
 * vive en el emblema del hero, no aquí. El mini emblema es un SVG
 * estático chico. Cero costo en reposo.
 */

type Props = {
  /** Variante mínima para Hoy: barra + mensaje, tap lleva a Órbita. */
  compact?: boolean
}

export function TransformationCard({ compact = false }: Props) {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { progress } = useTransformProgress()
  const [open, setOpen] = useState(false)
  // Press feedback for the "Ver en Órbita" link (haptic off — openOrbita
  // already fires a selection tick).
  const orbitPress = usePressFeedback({ haptic: false })

  // Los 12 signos tienen emblema (FRAMES_BY_SIGN). Sin perfil aún → nada
  // (capa de recompensa: jamás un spinner, jamás un placeholder); y la tarjeta
  // no existe hasta el primer hábito (progress 0 → el despertar se descubre).
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null
  if (sign == null || progress <= 0) return null

  // Semilla del día (medianoche local en días-epoch): estable todo el día,
  // distinta mañana — rota la línea del coach dentro de la etapa.
  const now = new Date()
  const daySeed = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000,
  )
  const line = dailyCoachLine(progress, daySeed, signName(sign))

  const openOrbita = () => {
    Haptics.selectionAsync().catch(() => {})
    requestOrbitSegment('mes')
    router.navigate({ pathname: '/orbit' })
  }
  const toggleExplainer = () => {
    Haptics.selectionAsync().catch(() => {})
    setOpen((v) => !v)
  }

  if (compact) {
    return (
      <View style={styles.compact}>
        <EyebrowLabel tone="magenta">Tu transformación</EyebrowLabel>

        <View style={styles.compactRow}>
          {/* Texto: identidad + avance (Leo · 53%) y la voz del estado. La
              protagonista es la SENSACIÓN de avance, no el número. */}
          <View style={styles.compactText}>
            <Text style={styles.signPct}>
              <Text style={styles.signName}>{signName(sign)}</Text>
              <Text style={styles.dot}> · </Text>
              <Text style={styles.pctInline}>{progress}%</Text>
            </Text>
            <Text style={styles.phrase}>{line}</Text>

            <Pressable
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Ver tu evolución en Órbita"
              accessibilityHint="Abre la línea de evolución"
              onPress={openOrbita}
              onPressIn={orbitPress.onPressIn}
              onPressOut={orbitPress.onPressOut}
              style={styles.orbitLink}
            >
              <Animated.View style={[styles.orbitLinkRow, orbitPress.animatedStyle]}>
                <Text style={styles.orbitLinkText}>Ver evolución</Text>
                <ChevronHint direction="right" size={16} color={colors.magenta} />
              </Animated.View>
            </Pressable>
          </View>

          {/* El emblema compacto — el símbolo visible del crecimiento, brillando
              más conforme se revela. */}
          <CompactEmblem sign={sign} progress={progress} size={88} />
        </View>

        {/* Garantía anti-castigo: nada de lo revelado se pierde. */}
        <Text style={styles.guarantee}>Tu transformación nunca retrocede.</Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <EyebrowLabel tone="magenta">Tu transformación</EyebrowLabel>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cómo funciona tu transformación"
          accessibilityState={{ expanded: open }}
          onPress={toggleExplainer}
        >
          <Text style={[styles.infoGlyph, open && styles.infoGlyphOpen]}>ⓘ</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.pctBlock}>
          <Text style={styles.pct}>
            {progress}
            <Text style={styles.pctSign}>%</Text>
          </Text>
          <Text style={styles.pctCaption}>transformación{'\n'}revelada</Text>
        </View>
        <View style={styles.barZone}>
          <RevealBar progress={progress} />
        </View>
        <View style={styles.emblemMini}>
          <CompactEmblem sign={sign} progress={progress} size={56} />
        </View>
      </View>

      <Text style={styles.message}>{line}</Text>
      <Text style={styles.guarantee}>Tu transformación nunca retrocede.</Text>

      {open ? <Explainer /> : null}
    </View>
  )
}

/* ── La barra de reveal ────────────────────────────────────────────── */

// Riel + relleno magenta + la chispa ✦ en el borde del avance. Views
// planas, sin SVG ni animación: el progreso cambia pocas veces al día.
// Solo vive en la variante full (Órbita · Mes); Hoy ya no muestra barra.
function RevealBar({ progress }: { progress: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${progress}%` }]} />
      <Text style={[styles.spark, { left: `${progress}%` }]}>✦</Text>
    </View>
  )
}

/* ── El explainer (ⓘ) ──────────────────────────────────────────────── */

// El sistema, dicho una vez y bien: qué responde cada cielo, cómo se
// alimenta, y las reglas — todas en positivo (aquí nada se resta).
const UNIVERSE_RULES = [
  'Cada registro alimenta tu universo.',
  'Cada cuidado te transforma.',
  'Nada se resta: aquí solo se suma.',
  'Lo revelado nunca se esconde.',
  'Tu transformación no se reinicia: es tuya.',
] as const

function Explainer() {
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.explainer}>
      <Text style={styles.expEyebrow}>Dos sistemas, un propósito</Text>
      <View style={styles.expRow}>
        <Text style={styles.expGlyph}>✦</Text>
        <Text style={styles.expBody}>
          <Text style={styles.expTerm}>Tu constelación</Text> responde al movimiento: crece cuando
          entrenas y empieza de nuevo cada mes. Pregunta “¿cuánto me moví?”.
        </Text>
      </View>
      <View style={styles.expRow}>
        <Text style={styles.expGlyph}>♌</Text>
        <Text style={styles.expBody}>
          <Text style={styles.expTerm}>Tu emblema</Text> es transformación: escucha todos tus
          hábitos y nunca se reinicia. Responde “¿en quién me estoy convirtiendo?”.
        </Text>
      </View>

      <Text style={styles.expEyebrow}>Cómo funciona</Text>
      <Text style={styles.expBody}>
        Cada registro cuenta: el movimiento, la comida, el sueño, el agua, cómo te sentiste. Todo
        suma, y tu Leo se revela por etapas, una parte nueva cada vez.
      </Text>

      <Text style={styles.expEyebrow}>Las reglas de tu universo</Text>
      {UNIVERSE_RULES.map((rule) => (
        <View key={rule} style={styles.expRow}>
          <Text style={styles.expGlyph}>✦</Text>
          <Text style={styles.expBody}>{rule}</Text>
        </View>
      ))}
    </Animated.View>
  )
}

/* ── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  /* full card */
  card: {
    marginTop: spacing.s5,
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s4,
    gap: spacing.s3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoGlyph: {
    fontFamily: typography.ui,
    fontSize: 15,
    color: colors.niebla,
  },
  infoGlyphOpen: {
    color: colors.magenta,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s4,
  },
  pctBlock: {
    alignItems: 'flex-start',
  },
  pct: {
    fontFamily: typography.uiSemi,
    fontSize: 28,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  pctSign: {
    fontSize: 13,
    color: colors.niebla,
  },
  pctCaption: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    lineHeight: 13,
  },
  barZone: {
    flex: 1,
  },
  emblemMini: {
    opacity: 0.9,
  },
  message: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.bone,
  },

  /* compact (Hoy) */
  compact: {
    marginTop: spacing.s5,
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s4,
    gap: spacing.s2,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    marginTop: spacing.s2,
  },
  compactText: {
    flex: 1,
    minWidth: 0,
  },
  compactHalo: {
    position: 'absolute',
  },
  // Identidad + avance: "Leo · 53%". El signo es la heroína; el % acompaña.
  signPct: {
    marginBottom: 4,
  },
  signName: {
    fontFamily: typography.displayHeavy,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.leche,
  },
  dot: {
    fontFamily: typography.uiMedium,
    fontSize: 18,
    color: colors.niebla,
  },
  pctInline: {
    fontFamily: typography.uiBold,
    fontSize: 19,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  // La voz del estado de evolución — emocional, no técnica.
  phrase: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 20,
    color: colors.bone,
  },
  // Garantía anti-castigo — voz del coach, callada (niebla), un escalón
  // por debajo del mensaje: una promesa de pie, no un titular.
  guarantee: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    marginTop: spacing.s1,
  },
  // Link explícito a Órbita·Mes — la ÚNICA navegación de la tarjeta, ahora
  // visible (no toda la tarjeta como hot-zone silenciosa).
  orbitLink: {
    alignSelf: 'flex-start',
    marginTop: spacing.s2,
    paddingVertical: 4,
  },
  orbitLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  orbitLinkText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
    color: colors.magenta,
  },

  /* la barra */
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.hairline,
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.magenta,
  },
  spark: {
    position: 'absolute',
    top: -5,
    marginLeft: -7,
    fontSize: 13,
    color: colors.oroLeche,
    textShadowColor: colors.magentaGlow,
    textShadowRadius: 6,
  },

  /* explainer */
  explainer: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.s3,
    gap: spacing.s2,
  },
  expEyebrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: spacing.s2,
  },
  expRow: {
    flexDirection: 'row',
    gap: spacing.s2,
    alignItems: 'flex-start',
  },
  expGlyph: {
    fontSize: 11,
    lineHeight: 18,
    color: colors.magenta,
  },
  expBody: {
    flex: 1,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.bone,
  },
  expTerm: {
    fontFamily: typography.uiMedium,
    color: colors.leche,
  },
})
