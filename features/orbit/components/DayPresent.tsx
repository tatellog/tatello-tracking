import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import FoodVect from '@/assets/icons/food-vect.svg'
import NorthStar from '@/assets/icons/north-star.svg'
import { useCycleEnabled } from '@/features/cycle/useCycleEnabled'
import { useMacroTargets } from '@/features/macros/hooks'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { useTodaySignals } from '../hooks'
import { deriveDimensions } from '../logic'
import { HeroEmblem } from './HeroEmblem'
import {
  brightestToday,
  formatLongDate,
  presentChips,
  tomorrowFocus,
  weakestToday,
  type SignalChip,
} from '../present-logic'

// Arte dorado con destellos para cuerpo/sueño/energía/proteína — raster, así
// que van por <Image> (no SvgImage: evita el re-rasterizado que salta al hacer
// scroll en Android). Van en oro; el color de la dimensión vive en el aro.
const MOVEMENT_PNG = require('@/assets/icons/movement.png')
const SUENO_PNG = require('@/assets/icons/sueno.png')
const ENERGIA_PNG = require('@/assets/icons/energia.png')
const PROTEIN_PNG = require('@/assets/icons/protein.png')
const CICLO_PNG = require('@/assets/icons/ciclo.png')
const MENTE_PNG = require('@/assets/icons/mente.png')
const AGUA_PNG = require('@/assets/icons/agua.png')

/*
 * Órbita · Día — "Tu órbita de hoy".
 *
 * Un centro de situación, NO una segunda Hoy. Responde "¿cómo va mi día?" en
 * 5 segundos con cuatro piezas derivadas de las señales de HOY (present-
 * logic.ts): lo que más brilló (héroe con emblema brillante), lo que también
 * estuvo presente (chips con su dato), lo que menos apareció y un enfoque
 * suave para mañana. Sin galaxia, sin órbitas, sin constelación, sin IA.
 *
 * El color de cada señal vive en el ANILLO/halo del emblema (patrón del
 * orbital), no en el glyph — los glyphs son plates de oro cálido; el aura
 * tintada es la que da la identidad cromática de la dimensión.
 */

// Acentos por señal. Las seis dimensiones salen de colors.dimension; proteína
// y agua no son dimensiones, así que llevan su propio azul de señal.
const SIGNAL_COLOR: Record<string, string> = {
  cuerpo: colors.dimension.cuerpo,
  alimento: colors.dimension.alimento,
  comida: colors.dimension.alimento,
  energia: colors.dimension.energia,
  sueno: colors.dimension.sueno,
  mente: colors.dimension.mente,
  ciclo: colors.dimension.ciclo,
  proteina: colors.signal.proteina,
  agua: colors.signal.agua,
  // El emblema de "enfoque" usa el magenta de la voz, no un tono de dimensión.
  star: colors.magenta,
}

// El oro cálido de la familia de glyphs — para los contextos NO tintados
// (chips + emblema secundario), donde el glyph va dorado dentro de su anillo.
const GLYPH_GOLD = '#EEDD91'

/* El slide de Hoy donde se registra cada señal (el `targetSlide` de StatSlider).
 * cuerpo (DayCheckIn) y agua (QuickLog ✦) viven en la raíz de Hoy → sin slide. */
const SLIDE_FOR: Record<string, string> = {
  alimento: 'macros',
  comida: 'macros',
  proteina: 'macros',
  energia: 'wellbeing',
  mente: 'wellbeing',
  sueno: 'sleep',
  ciclo: 'cycle',
}

/* Tocar una señal abre su significado (Órbita OBSERVA: explica qué es y por qué
 * cuenta, sin aconsejar) + un acceso para registrarla. Copy en voz Stelar. */
const SIGNAL_MEANING: Record<string, { label: string; meaning: string }> = {
  cuerpo: {
    label: 'Movimiento',
    meaning:
      'Mover el cuerpo —entrenar o descansar activo— acompaña tu energía y tu recomposición.',
  },
  alimento: {
    label: 'Comida',
    meaning: 'Lo que comes es el centro de tu día. Aquí cuentan las comidas que registraste.',
  },
  comida: {
    label: 'Comida',
    meaning: 'Lo que comes es el centro de tu día. Aquí cuentan las comidas que registraste.',
  },
  proteina: {
    label: 'Proteína',
    meaning:
      'La proteína acompaña tu masa muscular mientras bajas de peso. Es la métrica que más cuidamos.',
  },
  energia: {
    label: 'Energía',
    meaning:
      'Cómo te sentiste de pila hoy. Tu energía es una de las señales que leemos para entender tus patrones.',
  },
  mente: {
    label: 'Mente',
    meaning: 'Tu ánimo, motivación y calma — una dimensión más de cómo viene tu día.',
  },
  sueno: {
    label: 'Sueño',
    meaning:
      'El sueño acompaña casi todo lo demás: tu energía, tus antojos y tu ánimo del día siguiente.',
  },
  agua: {
    label: 'Agua',
    meaning: 'La hidratación acompaña tu día. Llevas el conteo de tus vasos aquí.',
  },
  ciclo: {
    label: 'Ciclo',
    meaning: 'Tu ciclo da contexto a la balanza y a tus patrones estos días.',
  },
}

/* Renderiza el glyph de una señal DENTRO de su caja (`box` = tamaño del
 * contenedor). El arte PNG dorado trae padding interno, así que llena ~0.82 de
 * la caja para pesar; los glyphs SVG van más compactos (~0.46). Todos van en
 * oro: el color de la dimensión lo da el aro/halo del emblema o del chip. */
function glyphFor(key: string, box: number, tint?: string) {
  // Los PNG vienen recortados a su contenido + ~8% de margen uniforme, así que
  // llenan la caja casi completa (contain, sin recortes). Los SVG van compactos.
  const pngStyle = { width: box, height: box }
  const png = (src: number) => <Image source={src} style={pngStyle} resizeMode="contain" />
  // SVG (comida/estrella) a 0.7 — antes 0.5 los hacía verse a media escala
  // junto a los PNG que llenan la caja.
  const s = box * 0.7
  const p = { width: s, height: s, preserveAspectRatio: 'xMidYMid meet' as const }
  switch (key) {
    case 'cuerpo':
      // En el héroe se tinta al magenta de la dimensión (tintColor aplana el oro
      // a magenta plano, conservando alpha → runner magenta con sus destellos).
      // Como chip va sin tint = oro.
      return (
        <Image
          source={MOVEMENT_PNG}
          style={[pngStyle, tint ? { tintColor: tint } : null]}
          resizeMode="contain"
        />
      )
    case 'sueno':
      return png(SUENO_PNG)
    case 'energia':
      return png(ENERGIA_PNG)
    case 'proteina':
      return png(PROTEIN_PNG)
    case 'ciclo':
      return png(CICLO_PNG)
    case 'mente':
      return png(MENTE_PNG)
    case 'agua':
      return png(AGUA_PNG)
    case 'alimento':
    case 'comida':
      return <FoodVect {...p} color={GLYPH_GOLD} />
    case 'star':
      return <NorthStar {...p} />
    default:
      return png(MOVEMENT_PNG)
  }
}

/** Emblema brillante — el glyph dentro de un aura radial + anillo tintado de
 *  la señal. SVG estático (sin animación pesada): solo da el resplandor. */
function Emblem({
  glyphKey,
  size,
  intensity = 1,
}: {
  glyphKey: string
  size: number
  intensity?: number
}) {
  const color = SIGNAL_COLOR[glyphKey] ?? colors.oro
  const id = `emblem-${glyphKey}`
  const r = size / 2
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.5 * intensity} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.14 * intensity} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
        <Circle
          cx={r}
          cy={r}
          r={r - 6}
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          opacity={0.85}
        />
        <Circle cx={r} cy={r} r={r - 2} stroke={color} strokeWidth={1} fill="none" opacity={0.25} />
      </Svg>
      {glyphFor(glyphKey, size)}
    </View>
  )
}

/** Fila de chips de las señales que también estuvieron presentes — cada una
 *  con su glyph dorado dentro de un anillo tintado + su dato concreto. Tocar un
 *  chip lleva a registrar esa señal (`onPress`). */
function ChipsRow({ chips, onPress }: { chips: SignalChip[]; onPress: (key: string) => void }) {
  return (
    <View style={styles.chipsRow}>
      {chips.map((c) => {
        const color = SIGNAL_COLOR[c.key] ?? colors.oro
        return (
          <Pressable
            key={c.key}
            style={styles.chip}
            onPress={() => onPress(c.key)}
            accessibilityRole="button"
            accessibilityLabel={`${c.label}, ${c.value}`}
            accessibilityHint={`Abre qué significa ${c.label.toLowerCase()}`}
          >
            <View
              style={[
                styles.chipCircle,
                { borderColor: `${color}40`, backgroundColor: `${color}0F` },
              ]}
            >
              {glyphFor(c.key, 56)}
            </View>
            <Text style={styles.chipLabel} numberOfLines={1}>
              {c.label}
            </Text>
            <Text style={styles.chipValue} numberOfLines={1}>
              {c.value}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function DayPresent() {
  const router = useRouter()
  const { data, isLoading, isError, refetch } = useTodaySignals()
  const signals = data ?? null

  // Tap → abre el significado de esa señal.
  const [openKey, setOpenKey] = useState<string | null>(null)
  // Desde el detalle: navega a donde se registra (forma de objeto — el string
  // con `?slide=` no aterrizaba). Con slide hace scroll; sin slide → raíz de Hoy.
  const register = (key: string) => {
    setOpenKey(null)
    const slide = SLIDE_FOR[key]
    if (slide) router.navigate({ pathname: '/(tabs)', params: { slide } })
    else router.navigate('/(tabs)')
  }

  const targets = useMacroTargets()
  const calorieTarget = targets.data?.calories ?? null
  const proteinTarget = targets.data?.protein_g ?? null
  const cycleEnabled = useCycleEnabled()

  const dimensions = deriveDimensions(signals, { calorieTarget, proteinTarget, cycleEnabled })

  const hero = brightestToday(dimensions, signals)
  const weak = weakestToday(dimensions, signals, { excludeKey: hero?.key })
  const chips = presentChips(signals, {
    cycleEnabled,
    excludeKeys: [hero?.key, weak?.key].filter((k) => k != null),
  })
  const focus = tomorrowFocus(weak)

  const settled = !isLoading
  // Vacío real = nada que mostrar. Ojo: el héroe ahora solo es una ACCIÓN, así
  // que un día con solo auto-ratings (energía/mente) o ciclo no tiene héroe
  // pero SÍ tiene chips → no es "vacío".
  const nothingToday = settled && hero == null && weak == null && chips.length === 0

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Tu órbita de hoy</Text>
      <Text style={styles.date}>{formatLongDate(todayInTimezone())}</Text>
    </View>
  )

  // Primera carga sin datos en caché: un placeholder cálido en vez de la
  // tarjeta vacía (antes, durante el load, hero=null + chips=[] dejaban la
  // pantalla en blanco salvo el header).
  if (!settled && signals == null) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardBody}>Mirando tu cielo de hoy…</Text>
        </View>
      </Animated.View>
    )
  }

  if (isError) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>El cielo de hoy no terminó de cargar</Text>
          <Text style={styles.cardBody}>Vuelve a intentarlo en un momento.</Text>
          <Text
            style={styles.retry}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            Reintentar
          </Text>
        </View>
      </Animated.View>
    )
  }

  if (nothingToday) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tu día aún está en calma</Text>
          <Text style={styles.cardBody}>
            En cuanto registres algo —una comida, tu sueño, un vaso de agua— aparece aquí cómo va tu
            día.
          </Text>
        </View>
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {header}

      {/* Lo que más brilló hoy — héroe con emblema brillante + chips de lo que
          también estuvo presente, todo en una sola tarjeta. */}
      {hero ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Lo que más brilló hoy</Text>
          <Pressable
            style={styles.heroEmblem}
            onPress={() => setOpenKey(hero.key)}
            accessibilityRole="button"
            accessibilityLabel={`${hero.label}, lo que más brilló hoy`}
            accessibilityHint={`Abre qué significa ${hero.label.toLowerCase()}`}
          >
            <HeroEmblem color={SIGNAL_COLOR[hero.key] ?? colors.oro}>
              {glyphFor(hero.key, 120, SIGNAL_COLOR[hero.key])}
            </HeroEmblem>
          </Pressable>
          <Text style={styles.heroTitle}>{hero.label}</Text>
          <Text style={styles.heroLine}>{hero.line}</Text>

          {chips.length > 0 ? (
            <View style={styles.chipsBlock}>
              <Text style={styles.subEyebrow}>También estuvieron presentes</Text>
              <ChipsRow chips={chips} onPress={setOpenKey} />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Sin acción registrada todavía (solo auto-ratings/ciclo): no hay héroe,
          pero mostramos lo que SÍ quedó anotado para no esconder el registro. */}
      {!hero && chips.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Lo que registraste hoy</Text>
          <View style={styles.card}>
            <ChipsRow chips={chips} onPress={setOpenKey} />
          </View>
        </View>
      ) : null}

      {/* Lo que menos apareció — la dimensión que pide más cuidado, con dato
          + sugerencia suave. */}
      {weak ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Lo que menos apareció</Text>
          <Pressable
            style={styles.card}
            onPress={() => setOpenKey(weak.key)}
            accessibilityRole="button"
            accessibilityLabel={`${weak.label}, ${weak.value}`}
            accessibilityHint={`Abre qué significa ${weak.label.toLowerCase()}`}
          >
            <View style={styles.weakRow}>
              <Emblem glyphKey={weak.key} size={64} intensity={0.7} />
              <View style={styles.weakText}>
                <Text style={styles.weakTitle}>{weak.label}</Text>
                <Text style={styles.weakValue}>{weak.value}</Text>
                <Text style={styles.weakSuggestion}>{weak.suggestion}</Text>
              </View>
              {/* Cue de navegación — esta sección es la más accionable. */}
              <Text style={styles.weakChevron}>›</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* Tu enfoque para mañana — un foco cálido que mira adelante. */}
      {focus ? (
        <View style={styles.section}>
          <Text style={styles.focusEyebrow}>Tu enfoque para mañana</Text>
          <View style={styles.focusCard}>
            <Text style={styles.focusLine}>{focus}</Text>
            <View style={styles.focusEmblem}>
              <Emblem glyphKey="star" size={64} intensity={0.9} />
            </View>
          </View>
        </View>
      ) : null}

      <SignalDetailModal openKey={openKey} onClose={() => setOpenKey(null)} onRegister={register} />
    </Animated.View>
  )
}

/** Detalle al tocar una señal — qué significa (Órbita observa, explica) + un
 *  acceso para registrarla. Un Modal ligero; toca fuera para cerrar. */
function SignalDetailModal({
  openKey,
  onClose,
  onRegister,
}: {
  openKey: string | null
  onClose: () => void
  onRegister: (key: string) => void
}) {
  const info = openKey ? SIGNAL_MEANING[openKey] : null
  return (
    <Modal visible={openKey != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        {/* Stop propagation: tocar la tarjeta no cierra. */}
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {info && openKey ? (
            <>
              <View style={styles.modalEmblem}>
                <Emblem glyphKey={openKey} size={84} />
              </View>
              <Text style={styles.modalTitle}>{info.label}</Text>
              <Text style={styles.modalMeaning}>{info.meaning}</Text>
              <Pressable
                style={styles.modalCta}
                onPress={() => onRegister(openKey)}
                accessibilityRole="button"
                accessibilityLabel={`Registrar ${info.label.toLowerCase()}`}
              >
                <Text style={styles.modalCtaText}>Registrar {info.label.toLowerCase()} →</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
                <Text style={styles.modalClose}>Cerrar</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontFamily: typography.uiBold,
    fontSize: 22,
    color: colors.leche,
  },
  date: {
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },

  // ── Hero card ────────────────────────────────────────────────────
  heroCard: {
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  heroEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  heroEmblem: {
    alignItems: 'center',
    // El PAD del glow del emblema ya da el aire — el margen extra era de más
    // (emblema flotando en vacío + "lo que menos apareció" cortado).
    marginTop: 6,
  },
  heroTitle: {
    marginTop: 4,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 30,
    lineHeight: 36,
    color: colors.leche,
    textAlign: 'center',
  },
  heroLine: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // ── "También estuvieron presentes" chips ─────────────────────────
  chipsBlock: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  subEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 16,
  },
  // Grid que envuelve: 3 por fila. Antes eran 6 en una sola fila con flex:1,
  // y "Movimiento" no cabía (se partía "Movimient/o" y desalineaba los valores).
  // A ~30% de ancho los labels caben en una línea; el número de chips es
  // dinámico (4–6) y `center` deja prolijas las filas parciales.
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: 18,
    columnGap: 8,
  },
  chip: {
    width: '30%',
    alignItems: 'center',
  },
  chipCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El label identifica la dimensión; el VALOR es el dato que importa para
  // "¿cómo voy?", así que se sube de niebla→bone y +1px para que no sea un
  // susurro junto al nombre.
  chipLabel: {
    marginTop: 9,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.leche,
    textAlign: 'center',
  },
  chipValue: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    textAlign: 'center',
  },

  // ── Sections ─────────────────────────────────────────────────────
  section: {
    marginTop: 22,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.bone,
    marginBottom: 12,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  cardTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 26,
    color: colors.leche,
  },
  cardBody: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.niebla,
  },
  retry: {
    marginTop: 14,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.oro,
  },

  // ── "Lo que menos apareció" ──────────────────────────────────────
  weakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  weakText: {
    flex: 1,
  },
  weakTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 27,
    color: colors.leche,
  },
  weakValue: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  weakSuggestion: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 18,
    color: colors.niebla,
  },
  weakChevron: {
    fontFamily: typography.ui,
    fontSize: 24,
    color: colors.niebla,
    marginLeft: 4,
  },

  // ── Detalle de señal (modal "qué significa") ─────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 22,
    backgroundColor: colors.bgCard2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
  },
  modalEmblem: {
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 26,
    lineHeight: 32,
    color: colors.leche,
    textAlign: 'center',
  },
  modalMeaning: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.niebla,
    textAlign: 'center',
  },
  modalCta: {
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.magenta,
  },
  modalCtaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.leche,
  },
  modalClose: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },

  // ── "Tu enfoque para mañana" ─────────────────────────────────────
  focusEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.magenta,
    marginBottom: 12,
  },
  focusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 20,
    padding: 18,
    backgroundColor: colors.magentaTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.magentaTint2,
  },
  focusLine: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 24,
    color: colors.leche,
  },
  focusEmblem: {
    width: 64,
  },
})
