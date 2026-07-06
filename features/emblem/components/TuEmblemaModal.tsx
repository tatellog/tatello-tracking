import { Feather } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { useEffect } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'

import ChoreStar from '@/assets/icons/choreStar.svg'
import EmblemHalo from '@/assets/zodiac-art/emblem-halo-frame.svg'
import { useTransformProgress } from '@/features/emblem'
import {
  FRAMES_BY_SIGN,
  frameIndexFor,
} from '@/features/tabs/components/constellation/RevealedEmblem'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, radius, spacing, typography } from '@/theme'

export type EmblemStar = { name: string; role: string }

// Polvo de estrellas quieto del fondo del modal — posiciones fijas (no
// random, para que no parpadee entre renders) en el tercio superior, lejos
// del emblema. Distintos radios/brillos para dar profundidad sin competir.
const STAR_DUST = [
  { x: 14, y: 12, r: 1.1, o: 0.5 },
  { x: 82, y: 9, r: 0.9, o: 0.42 },
  { x: 68, y: 19, r: 1.4, o: 0.6 },
  { x: 28, y: 24, r: 0.8, o: 0.34 },
  { x: 90, y: 28, r: 1.1, o: 0.46 },
  { x: 8, y: 33, r: 1.2, o: 0.4 },
  { x: 50, y: 7, r: 0.7, o: 0.3 },
  { x: 40, y: 16, r: 0.9, o: 0.38 },
] as const

type TuEmblemaModalProps = {
  visible: boolean
  onClose: () => void
  /** Clave del signo — para el emblema correcto (el MISMO emblema del Tab Hoy). */
  sign: ZodiacSign
  /** La etiqueta del signo en MAYÚSCULAS ("LEO", "ARIES", …). */
  signLabel: string
  /** Figure stars lit THIS MONTH (any registered day) + the figure total. */
  trained: number
  total: number
  /** Named figure stars already lit, in lighting order. */
  litStars: EmblemStar[]
  /** The next star to light (named, anticipation — not a countdown). */
  nextStar: EmblemStar | null
}

/**
 * Calienta el caché de RN Image con el frame del emblema ANTES de abrir el modal.
 * El hero pinta el emblema en Skia (otro caché), así que sin esto la primera
 * apertura del modal decodifica el PNG en frío y se nota el retraso. Render
 * persistente y oculto en Hoy: decodifica una vez y queda caliente.
 */
export function EmblemFramePreloader({ sign }: { sign: ZodiacSign }) {
  const { progress } = useTransformProgress()
  const frames = FRAMES_BY_SIGN[sign]
  const frame = frames[frameIndexFor(progress)] ?? frames[frames.length - 1]
  return (
    <Image
      source={frame}
      style={styles.preloader}
      fadeDuration={0}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}

/**
 * "Tu {signo}" — opened from the compact constellation hero on Hoy, over a
 * blurred Hoy (revelaciones language). Sign-agnostic: emblem, label, count and
 * named stars all derive from `sign`. PROGRESS-FOCUSED per the product
 * critique: the explicit % + count of the month's figure, the named stars lit
 * so far, and what's next — so it answers "¿cuánto llevo y qué sigue?", not
 * just "mira el arte". The gold figure is the representative art of your sign;
 * the data is the monthly constellation. No actions; the only control is ✕.
 */
export function TuEmblemaModal({
  visible,
  onClose,
  sign,
  signLabel,
  trained,
  total,
  litStars,
  nextStar,
}: TuEmblemaModalProps) {
  const pct = total > 0 ? Math.round((trained / total) * 100) : 0
  // El signo en title-case para leerlo dentro de una frase ("Tu Leo se
  // revela…"). `signLabel` llega en MAYÚSCULAS (ZODIAC[sign].label), que en
  // medio de un texto gritaría. Dinámico: jamás "emblema" hardcodeado.
  const signTitle = signLabel.charAt(0).toUpperCase() + signLabel.slice(1).toLowerCase()
  // Halo brightens with progress — light grows as the figure fills.
  const haloOpacity = 0.3 + (pct / 100) * 0.6
  // EL MISMO emblema del Tab Hoy (el frame del % de revelado vigente), como
  // <Image> plano — no Skia, así no choca TextureViews con el del hero detrás.
  const { progress: emblemProgress } = useTransformProgress()
  const frames = FRAMES_BY_SIGN[sign]
  const emblemFrame = frames[frameIndexFor(emblemProgress)] ?? frames[frames.length - 1]

  // La lista se capa a las 3 MÁS RECIENTES (más recientes arriba: "lo que
  // acabo de despertar") + un pie tenue con el resto. Altura fija sin importar
  // si vas en 6 o en 19 luces — la usuaria vino a sentir el avance, no a
  // auditar el catálogo entero.
  const RECENT_LIMIT = 3
  const recentStars = litStars.slice(-RECENT_LIMIT).reverse()
  const olderCount = litStars.length - recentStars.length

  // Entrada con CRAFT: el card no aparece de golpe — emerge del cosmos con un
  // resorte suave (sube + escala + funde). Hace que se sienta "revelado", no
  // un diálogo del sistema. Reduce-motion lo deja en su sitio al instante.
  const reduce = useReducedMotion()
  const enter = useSharedValue(0)
  useEffect(() => {
    // Solo al ABRIR: reseteo a 0 y disparo el resorte. Al cerrar dejo el valor
    // quieto y la salida la funde el animationType="fade" del Modal (sin snap).
    if (!visible) return
    enter.value = 0
    enter.value = reduce ? 1 : withSpring(1, { damping: 19, stiffness: 190, mass: 0.7 })
  }, [visible, reduce, enter])
  const cardAnim = useAnimatedStyle(() => ({
    // La opacidad funde más rápido que asienta el resorte (sin parpadeo por
    // el overshoot del spring).
    opacity: Math.min(1, enter.value * 1.5),
    transform: [{ translateY: (1 - enter.value) * 18 }, { scale: 0.94 + enter.value * 0.06 }],
  }))

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Blurred, dimmed Hoy behind — same language as the revelations. */}
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        {/* Scrim SOLO atenúa — no cierra. El modal se cierra solo con la ✕ (o
            el botón atrás de Android vía onRequestClose); un tap afuera lo
            mantiene abierto. */}
        <View style={styles.scrim}>
          {/* Wrapper animado: lleva el tamaño + la elevación (sombra fuera del
              overflow:hidden del card) y la entrada con resorte. */}
          <Animated.View style={[styles.cardWrap, cardAnim]}>
            <View style={styles.card}>
              {/* Atmósfera — el card deja de ser un panel plano: glow radial
                oro→magenta detrás del emblema + polvo de estrellas arriba +
                viñeta inferior que hunde el card en el cosmos. */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width="100%" height="100%">
                  <Defs>
                    <RadialGradient id="emblemGlow" cx="50%" cy="30%" r="62%">
                      <Stop offset="0%" stopColor={colors.oro} stopOpacity={0.26} />
                      <Stop offset="38%" stopColor={colors.magenta} stopOpacity={0.15} />
                      <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
                    </RadialGradient>
                    <LinearGradient id="emblemVignette" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor={colors.bg} stopOpacity={0} />
                      <Stop offset="68%" stopColor={colors.bg} stopOpacity={0} />
                      <Stop offset="100%" stopColor={colors.bg} stopOpacity={0.55} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#emblemGlow)" />
                  {/* Polvo de estrellas — quietas, distintos brillos (no compite
                    con el emblema, solo da profundidad). */}
                  {STAR_DUST.map((s, i) => (
                    <Circle
                      key={i}
                      cx={`${s.x}%`}
                      cy={`${s.y}%`}
                      r={s.r}
                      fill={colors.leche}
                      opacity={s.o}
                    />
                  ))}
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#emblemVignette)" />
                </Svg>
              </View>
              <Pressable
                style={styles.close}
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Feather name="x" size={20} color={colors.niebla} />
              </Pressable>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                bounces={false}
              >
                <Text style={styles.eyebrow}>TU {signLabel.toUpperCase()}</Text>

                {/* El emblema REINA (el emblema del Tab Hoy, no el medallón viejo). */}
                <View style={styles.emblemWrap}>
                  <EmblemHalo
                    width={152}
                    height={152}
                    style={[styles.halo, { opacity: haloOpacity }]}
                  />
                  <Image
                    source={emblemFrame}
                    style={styles.emblem}
                    resizeMode="contain"
                    accessibilityLabel={`Tu ${signLabel}. ${trained} de ${total} estrellas encendidas.`}
                  />
                </View>

                {/* LÍNEA DE PROPÓSITO — el "ah, ya entendí" arriba, no al pie:
                  qué es, por qué un {signTitle}, y cómo se llena. Antes vivía
                  enterrada en la leyenda; la usuaria solo la hallaba al final. */}
                <Text style={styles.purpose}>
                  La figura de tu {signTitle} tiene estrellas con nombre propio. Cada día que
                  registras algo enciende una de ellas.
                </Text>

                {/* Conteo reencuadrado a CRECIMIENTO: "N luces encendidas · este
                  mes" (no "N de M", que se leía como hueco/deuda). El total va
                  tenue bajo la barra, como contexto callado. */}
                <Text style={styles.headline}>
                  <Text style={styles.headlineNum}>{trained}</Text> luces encendidas
                  <Text style={styles.headlineMuted}> · este mes</Text>
                </Text>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                  {/* Spark clampeado para no salirse del track al 100 %. */}
                  <Text style={[styles.barSpark, { left: `${Math.min(pct, 96)}%` }]}>✦</Text>
                </View>
                <Text style={styles.barCaption}>de {total} en tu figura</Text>

                {/* "La que sigue" ANTES del catálogo: la anticipación tira hacia
                  adelante (lo que la usuaria sí quería sentir). Tres estados:
                  · queda una estrella con nombre → la nombramos (lo más rico)
                  · ya no quedan nombres pero la figura sigue → "se sigue tejiendo"
                  · figura completa → la luz extra de cada «Entrené». */}
                {nextStar ? (
                  <View style={styles.comingPanel}>
                    <View style={styles.comingTextCol}>
                      <Text style={styles.comingEyebrow}>La que sigue</Text>
                      <Text style={styles.comingName}>{nextStar.name}</Text>
                      <Text style={styles.comingRole}>{nextStar.role}</Text>
                    </View>
                    {/* Astro sobre un resplandor radial: lo difumina e integra
                        al panel (igual que el halo del sheet) en vez de leerse
                        como un icono pegado y crudo. */}
                    <View style={styles.comingStar}>
                      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Defs>
                          <RadialGradient id="comingGlow" cx="50%" cy="50%" r="50%">
                            <Stop offset="0%" stopColor={colors.oro} stopOpacity={0.3} />
                            <Stop offset="42%" stopColor={colors.oro} stopOpacity={0.09} />
                            <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
                          </RadialGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#comingGlow)" />
                      </Svg>
                      <ChoreStar width={52} height={72} opacity={0.92} />
                    </View>
                  </View>
                ) : trained < total ? (
                  <Text style={styles.comingLine}>
                    Tu figura se sigue <Text style={styles.comingEm}>tejiendo</Text>.
                  </Text>
                ) : (
                  <Text style={styles.comingLine}>
                    Tu figura está <Text style={styles.comingEm}>completa</Text>. Cada día
                    registrado suma luz extra.
                  </Text>
                )}

                {/* "Lo que ya despertó" — ahora TEXTURA/recompensa, ya con el
                  modelo entendido: los nombres astronómicos no cargan el primer
                  vistazo, se disfrutan de vuelta. */}
                {recentStars.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionEyebrow}>Lo que ya despertó</Text>
                    {recentStars.map((s, idx) => (
                      <View
                        key={s.name}
                        style={[styles.starRow, idx > 0 ? styles.starRowDivider : null]}
                      >
                        <Text style={styles.starDot}>✦</Text>
                        <Text style={styles.starName}>{s.name}</Text>
                        <Text style={styles.starRole} numberOfLines={1}>
                          {s.role}
                        </Text>
                      </View>
                    ))}
                    {olderCount > 0 ? (
                      <Text style={styles.olderLine}>
                        y {olderCount} {olderCount === 1 ? 'más encendida' : 'más encendidas'}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Cierre de largo plazo — la SEGUNDA capa (el signo se revela con
                  el tiempo), que antes se mezclaba con la mecánica en la leyenda. */}
                <Text style={styles.closingLine}>
                  Tu <Text style={styles.closingKey}>{signTitle}</Text> se revela despacio, con todo
                  lo que sostienes.
                </Text>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 8, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  // Wrapper: tamaño + elevación. La sombra vive AQUÍ (no en el card) porque el
  // card tiene overflow:hidden y recortaría su propia sombra. Una caída warm
  // honda lo despega del cosmos difuminado del fondo.
  cardWrap: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '100%',
    borderRadius: radius.card,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  card: {
    width: '100%',
    maxHeight: '100%',
    backgroundColor: colors.bgCard2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    overflow: 'hidden',
  },
  scroll: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  // Botón cerrar — disco translúcido para una zona de toque clara sin gritar.
  close: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 236, 222, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.magenta,
  },
  // El emblema REINA — más grande, con aire debajo (es el héroe del card).
  emblemWrap: {
    width: 152,
    height: 152,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { position: 'absolute' },
  // El emblema ocupa ~0.76 del halo (estética sello: respira dentro del aro).
  emblem: { width: 116, height: 116 },
  // Línea de propósito — el ancla explicativa que abre el modal (voz de coach,
  // serif italic). Es el "ah, ya entendí" que antes vivía enterrado al pie.
  purpose: {
    alignSelf: 'stretch',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    color: colors.bone,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  // Titular cálido — el conteo de luces, no el %. Números en oro.
  headline: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.title,
    color: colors.bone,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  headlineNum: {
    fontFamily: typography.uiBold,
    color: colors.oroLeche,
    fontVariant: ['tabular-nums'],
  },
  // "· este mes" — contexto callado, no compite con el número.
  headlineMuted: {
    fontFamily: typography.uiMedium,
    color: colors.niebla,
  },
  // Total tenue bajo la barra ("de 19 en tu figura") — contexto, no deuda.
  barCaption: {
    alignSelf: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    marginTop: spacing.xs,
  },
  // Pie de la lista capada — "y N más encendidas", callado (no es una fila
  // más, es un resumen del resto). Alineado con los nombres (sangría del ✦).
  olderLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginTop: spacing.s2,
    marginLeft: spacing.lg,
  },
  // Progress bar — flat views (rail + fill + spark), like the RevealBar.
  barTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.hairline,
    overflow: 'visible',
  },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: colors.oro },
  barSpark: {
    position: 'absolute',
    top: -6,
    marginLeft: -7,
    fontSize: 13,
    color: colors.oroLeche,
    textShadowColor: colors.magentaGlow,
    textShadowRadius: 6,
  },
  section: { alignSelf: 'stretch', marginTop: spacing.md },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseTight,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: spacing.xs,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.s1 + 1,
  },
  // Divisor hairline oro entre filas — convierte la lista en "carta astral".
  starRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
  },
  starDot: { fontSize: typography.sizes.smallLabel, color: colors.oro },
  starName: { fontFamily: typography.uiSemi, fontSize: typography.sizes.body, color: colors.leche },
  starRole: {
    flexShrink: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  comingLine: {
    alignSelf: 'stretch',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    color: colors.bone,
    marginTop: spacing.lg,
  },
  comingEm: { fontFamily: typography.uiBold, color: colors.magenta },
  // Panel "La que sigue" — texto a la izquierda, astro a la derecha (eco del
  // hito del screenshot). Fondo tenue + hairline oro para que destaque sin gritar.
  comingPanel: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard,
  },
  comingTextCol: { flex: 1, gap: 2 },
  // Contenedor del astro: aloja el resplandor (absoluto, detrás) + la estrella.
  // Más ancho/alto que la estrella para que el glow respire alrededor.
  comingStar: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseTight,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  comingName: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLeche,
  },
  comingRole: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  // Cierre de largo plazo — la segunda capa (el signo se revela con el tiempo),
  // voz de coach (serif italic), separado por un hairline oro del resto.
  closingLine: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    color: colors.bone,
    textAlign: 'center',
  },
  closingKey: { fontFamily: typography.uiSemi, fontStyle: 'normal', color: colors.oroLeche },
  // Preloader invisible — 1×1, fuera de layout, solo para calentar el caché.
  preloader: { position: 'absolute', width: 1, height: 1, opacity: 0 },
})
