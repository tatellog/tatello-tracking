import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import LeoEmblemArt from '@/assets/zodiac-art/leo-emblem.svg'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { useProfile } from '@/features/profile/hooks'
import { zodiacFromDate } from '@/features/tabs/zodiac'
import { colors, radius, spacing, typography } from '@/theme'

import { useTransformProgress } from '../hooks'
import { dailyCoachLine } from '../logic'

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

  // Espejo de hasEmblem (LunarConstellation): solo Leo tiene arte de
  // emblema por ahora. Sin perfil aún → nada (capa de recompensa: jamás
  // un spinner, jamás un placeholder).
  const sign = profile ? zodiacFromDate(profile.date_of_birth) : null
  if (sign !== 'leo' || progress <= 0) return null

  // Semilla del día (medianoche local en días-epoch): estable todo el día,
  // distinta mañana — rota la línea del coach dentro de la etapa.
  const now = new Date()
  const daySeed = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000,
  )
  const line = dailyCoachLine(progress, daySeed)

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
        <View style={styles.header}>
          <EyebrowLabel tone="magenta">Tu transformación</EyebrowLabel>
          {/* El MISMO ⓘ del full, ahora donde vive la recompensa (Hoy):
              la explicación del sistema deja de estar escondida en Órbita. */}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tu transformación. ${line}`}
          accessibilityHint="Abre tu Órbita del mes"
          onPress={openOrbita}
        >
          <Text style={styles.compactMessage}>{line}</Text>
        </Pressable>
        {/* Garantía persistente — quita la lectura de castigo: nada de lo
            revelado se pierde. Voz del coach (italic). */}
        <Text style={styles.guarantee}>Tu transformación nunca retrocede.</Text>
        {open ? <Explainer /> : null}
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
          <LeoEmblemArt width={52} height={52} />
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
        suma — y tu Leo se revela por etapas, una parte nueva cada vez.
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
  // En compact la voz ES la tarjeta — un punto más de cuerpo que el
  // message del full, donde la frase comparte aire con % y barra.
  compactMessage: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
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
