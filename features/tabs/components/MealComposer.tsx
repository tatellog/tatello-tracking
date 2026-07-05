import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { PrimaryCta } from '@/components/PrimaryCta'
import { usePressFeedback } from '@/components/ui/interaction'
import { track } from '@/lib/analytics'
import { uploadMealPhoto, type FrequentMeal, type MealInput } from '@/features/macros/api'
import { useCreateMeal, useFrequentMeals, useMealsForDate } from '@/features/macros/hooks'
import { emitMealLogged } from '@/features/macros/meal-logged-bus'
import { mealMomentByHour } from '@/features/macros/meal-moment'
import { subscribeRegistroIntent, type MealMoment } from '@/features/macros/registro-intent'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { showActionSheet } from '@/lib/actionSheet'
import { resizeForDisplay } from '@/lib/image'
import { colors, typography } from '@/theme'

import { AllyCard } from './AllyCard'

const HISTORY_LIMIT = 24
// Aliados compactos por defecto · muestra estos y "Ver todas" para el resto.
const COLLAPSED_COUNT = 4
const CONFIRM_MS = 1000
// 4-point star — la chispa del preview de la nueva comida.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'
const PREVIEW_STAR = 19

type MealType = MealInput['meal_type']

const currentMealType = (): MealType => mealMomentByHour()

// ── Iconos de los métodos de registro ──
function SearchIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={1.8} />
      <Path d="M20 20 L16.2 16.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  )
}

function CameraIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={18} height={13} rx={3} stroke={color} strokeWidth={1.8} />
      <Path
        d="M9 7 L10.4 4.6 H13.6 L15 7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13.4} r={3.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}

function KeyboardIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={6} width={20} height={12} rx={2.5} stroke={color} strokeWidth={1.8} />
      <Path
        d="M6 10 H6.01 M10 10 H10.01 M14 10 H14.01 M18 10 H18.01 M8 14 H16"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/* Una tile de método de registro (Buscar / Foto / Escribir). Escala + haptic
 * del sistema de interacción; `active` resalta la tile seleccionada. */
function MethodTile({
  label,
  icon,
  onPress,
  active,
  accessibilityLabel,
}: {
  label: string
  icon: React.ReactNode
  onPress: () => void
  active?: boolean
  accessibilityLabel: string
}) {
  const { onPressIn, onPressOut, animatedStyle } = usePressFeedback()
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.methodHit}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.method, active && styles.methodActive, animatedStyle]}>
        <View style={styles.methodIcon}>{icon}</View>
        <Text style={styles.methodLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

/* La estrella-preview de la nueva comida — se enciende al llenar los macros y,
 * cuando la comida es válida, titila. Promesa silenciosa de "sumar al cielo". */
function StarPreview({ progress, valid }: { progress: number; valid: boolean }) {
  const active = useScreenActive()
  const lit = useSharedValue(0)
  const tw = useSharedValue(0)

  useEffect(() => {
    lit.value = withTiming(progress, { duration: 420, easing: Easing.out(Easing.cubic) })
  }, [progress, lit])

  useEffect(() => {
    if (valid && active) {
      tw.value = withRepeat(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
    } else if (valid) {
      cancelAnimation(tw)
      tw.value = withTiming(0.5, { duration: 300 })
    } else {
      cancelAnimation(tw)
      tw.value = withTiming(0, { duration: 300 })
    }
    return () => cancelAnimation(tw)
  }, [valid, tw, active])

  const starStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + lit.value * 0.52 + tw.value * 0.28,
    transform: [{ scale: 0.72 + lit.value * 0.2 + tw.value * 0.1 }],
  }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: lit.value * 0.45 + tw.value * 0.4,
  }))

  return (
    <View style={styles.previewWrap} pointerEvents="none">
      <Animated.View style={[styles.previewGlow, glowStyle]} />
      <Animated.View style={starStyle}>
        <Svg width={PREVIEW_STAR} height={PREVIEW_STAR} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={colors.magenta} />
        </Svg>
      </Animated.View>
    </View>
  )
}

type Props = {
  /** Abre una comida en el editor (misma pantalla que el quick-log de Hoy). */
  onOpenMeal: (id: string, photoPath?: string) => void
}

/*
 * El bloque de registro + aliados del Tab Comidas:
 *
 *   §2 CTA "+ Agregar comida" — la acción más visible; despliega…
 *   §4 "¿Cómo quieres registrar?" — Buscar · Foto · Escribir.
 *   §3 "Tus Aliados" — las comidas que más impulsan tu transformación:
 *      proteína como dato principal, "Repetir" para registrar en 1 tap.
 */
export function MealComposer({ onOpenMeal }: Props) {
  const { data: foods } = useFrequentMeals(HISTORY_LIMIT)
  const createMeal = useCreateMeal()
  const router = useRouter()
  const searchRef = useRef<TextInput>(null)

  const [registroOpen, setRegistroOpen] = useState(false)
  const [searchMode, setSearchMode] = useState(false)
  // Tipo forzado por la sección de Momentos (tocaste "○ Cena" → la próxima
  // comida se registra como cena, no por hora).
  const [forcedType, setForcedType] = useState<MealMoment | null>(null)
  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [calories, setCalories] = useState('')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const q = name.trim().toLowerCase()
  const composing = q.length > 0

  // Aliados ordenados por frecuencia (el ranking de medallas). Al buscar,
  // prioriza coincidencias por prefijo.
  const history = useMemo(() => {
    const all = [...(foods ?? [])]
    if (!q) return all.sort((a, b) => b.freq - a.freq)
    return all
      .filter((f) => f.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1
        return ap - bp
      })
  }, [foods, q])

  const exactMatch = history.some((f) => f.name.toLowerCase() === q)
  const proteinNum = parseFloat(protein)
  const caloriesNum = parseInt(calories, 10)
  const manualValid =
    name.trim().length >= 2 &&
    Number.isFinite(proteinNum) &&
    proteinNum >= 0 &&
    Number.isFinite(caloriesNum) &&
    caloriesNum > 0
  const previewProgress = ((protein.trim() ? 1 : 0) + (calories.trim() ? 1 : 0)) / 2

  // Al cerrar el editor de "nueva comida", suelta la foto preparada.
  useEffect(() => {
    if (!composing || exactMatch) setPhotoUri(null)
  }, [composing, exactMatch])

  // Tocar un momento pendiente (○ Cena) abre el registro con ese tipo fijado.
  useEffect(
    () =>
      subscribeRegistroIntent((mealType) => {
        setForcedType(mealType)
        setRegistroOpen(true)
        setSearchMode(true)
        setTimeout(() => searchRef.current?.focus(), 80)
      }),
    [],
  )

  const collapsible = !composing && history.length > COLLAPSED_COUNT
  const visible = collapsible && !expanded ? history.slice(0, COLLAPSED_COUNT) : history

  // "Como ayer" (MFP: el 80% de las comidas se repiten) — el atajo de un tap
  // a la comida de AYER en este mismo momento (desayuno/comida/cena). Solo
  // consulta con el registro abierto; sin comida de ayer en el momento, la
  // fila simplemente no existe.
  const yesterdayIso = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mm}-${dd}`
  }, [])
  const yesterMeals = useMealsForDate(registroOpen ? yesterdayIso : null)
  const activeMoment = forcedType ?? currentMealType()
  const comoAyer = useMemo(
    () => (yesterMeals.data ?? []).find((m) => m.meal_type === activeMoment) ?? null,
    [yesterMeals.data, activeMoment],
  )

  const handleComoAyer = () => {
    if (!comoAyer || confirmed) return
    log({
      name: comoAyer.name,
      protein_g: comoAyer.protein_g,
      calories: comoAyer.calories,
      photo_storage_path: comoAyer.photo_storage_path,
    })
    setConfirmed(comoAyer.name)
    setTimeout(() => setConfirmed((c) => (c === comoAyer.name ? null : c)), CONFIRM_MS)
  }

  // "Aliada" se gana con evidencia: repetición real o aporte de proteína
  // que mueva la aguja. Con una comida de 2 g registrada 1 vez, llamar a la
  // sección "lo que más impulsa tu transformación" enseña a descontar la
  // voz del coach. En frío la sección se presenta sin promesa inflada.
  const hasAliados = (foods ?? []).some((f) => f.freq >= 3 || f.protein_g >= 15)

  const clear = () => {
    setName('')
    setProtein('')
    setCalories('')
    setPhotoUri(null)
    setForcedType(null)
  }

  // CTA "+ Agregar comida" — despliega/colapsa el bloque de registro.
  const handleCta = () => {
    if (registroOpen) {
      setRegistroOpen(false)
      setSearchMode(false)
      clear()
    } else {
      setRegistroOpen(true)
    }
  }

  const handleSearchTile = () => {
    setSearchMode((s) => {
      const next = !s
      if (!next) clear()
      return next
    })
    setTimeout(() => searchRef.current?.focus(), 60)
  }

  // Re-loggear una comida conocida — camino rápido (1 tap), conserva su foto.
  const log = (meal: {
    name: string
    protein_g: number
    calories: number
    photo_storage_path?: string | null
  }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    emitMealLogged() // §6 · la luna celebra (partículas) — un solo conteo (no toca el universo)
    createMeal.mutate({
      name: meal.name,
      protein_g: meal.protein_g,
      calories: meal.calories,
      consumed_at: new Date(),
      meal_type: forcedType ?? currentMealType(),
      photo_storage_path: meal.photo_storage_path ?? undefined,
    })
    if (forcedType) setForcedType(null)
  }

  const handleRepeat = (item: FrequentMeal) => {
    if (confirmed) return
    log({
      name: item.name,
      protein_g: item.protein_g,
      calories: item.calories,
      photo_storage_path: item.photo_storage_path,
    })
    setConfirmed(item.name)
    setTimeout(() => setConfirmed((c) => (c === item.name ? null : c)), CONFIRM_MS)
  }

  // ── Registro con foto / texto — hand off al flujo /scan-meal ──
  const openScanPhoto = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Cámara', 'Necesitamos permiso a la cámara para tomar la foto.')
        return
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    router.push({ pathname: '/scan-meal', params: { uri: result.assets[0].uri } })
  }

  const handleScanPhoto = () => {
    track('quick_add_pressed', { method: 'photo' })
    showActionSheet(
      {
        title: 'Registrar comida con foto',
        options: ['Tomar foto', 'Elegir de la galería', 'Cancelar'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) void openScanPhoto('camera')
        else if (i === 1) void openScanPhoto('library')
      },
    )
  }

  const handleScanText = () => {
    track('quick_add_pressed', { method: 'text' })
    router.push({ pathname: '/scan-meal', params: { describe: '1' } })
  }

  const pickImage = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Cámara', 'Necesitamos permiso a la cámara para tomar la foto.')
        return
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setPhotoUri(await resizeForDisplay(asset.uri, asset.width))
  }

  const photoOptions = () => {
    const options = photoUri
      ? ['Tomar otra foto', 'Elegir de galería', 'Quitar foto', 'Cancelar']
      : ['Tomar foto', 'Elegir de galería', 'Cancelar']
    showActionSheet(
      {
        title: 'Foto del platillo',
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: photoUri ? 2 : undefined,
      },
      (i) => {
        if (i === 0) void pickImage('camera')
        else if (i === 1) void pickImage('library')
        else if (photoUri && i === 2) setPhotoUri(null)
      },
    )
  }

  const handleAddManual = async () => {
    if (!manualValid || submitting) return
    setSubmitting(true)
    let photoPath: string | undefined
    if (photoUri) {
      try {
        photoPath = await uploadMealPhoto(photoUri)
      } catch (e) {
        console.warn('[meal-composer] photo upload failed', e)
        Alert.alert('Foto', 'No pudimos guardar la foto, pero sí registramos la comida.')
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    emitMealLogged() // §6 · la luna celebra
    createMeal.mutate(
      {
        name: name.trim(),
        protein_g: proteinNum,
        calories: caloriesNum,
        consumed_at: new Date(),
        meal_type: forcedType ?? currentMealType(),
        photo_storage_path: photoPath,
      },
      {
        onSuccess: () => {
          clear()
          setSubmitting(false)
        },
        onError: () => setSubmitting(false),
      },
    )
  }

  return (
    <View>
      {/* ── §2 · Cerrar — el "+ Agregar comida" se movió al sticky button del
          tab (abre la cámara). Aquí solo queda el cierre para cuando Momentos
          abre el bloque (tocar ○ Cena → emitRegistroIntent). ── */}
      {registroOpen ? (
        <PrimaryCta
          label="Cerrar"
          variant="soft"
          onPress={handleCta}
          marginTop={6}
          accessibilityLabel="Cerrar el registro"
        />
      ) : null}

      {/* ── §4 · ¿Cómo quieres registrar? — Buscar · Foto · Escribir ── */}
      {registroOpen ? (
        <View style={styles.registro}>
          <Text style={styles.registroTitle}>¿Cómo quieres registrar?</Text>
          {/* El camino más corto primero: repetir lo de ayer en este momento
              es un tap. Aparece solo si ayer hubo comida en este momento. */}
          {comoAyer ? (
            <Pressable
              onPress={handleComoAyer}
              style={styles.comoAyer}
              accessibilityRole="button"
              accessibilityLabel={`Como ayer: ${comoAyer.name}`}
            >
              <View style={styles.comoAyerText}>
                <Text style={styles.comoAyerLabel}>
                  {confirmed === comoAyer.name ? '✦ Registrada' : 'Como ayer'}
                </Text>
                <Text style={styles.comoAyerName} numberOfLines={1}>
                  {comoAyer.name} · {Math.round(comoAyer.protein_g)} g ·{' '}
                  {Math.round(comoAyer.calories)} kcal
                </Text>
              </View>
              <Text style={styles.comoAyerChevron}>›</Text>
            </Pressable>
          ) : null}
          <View style={styles.methods}>
            <MethodTile
              label="Buscar"
              icon={<SearchIcon color={colors.magenta} />}
              onPress={handleSearchTile}
              active={searchMode}
              accessibilityLabel="Buscar una comida de tus aliados"
            />
            <MethodTile
              label="Foto"
              icon={<CameraIcon color={colors.magenta} size={20} />}
              onPress={handleScanPhoto}
              accessibilityLabel="Registrar una comida con foto"
            />
            <MethodTile
              label="Escribir"
              icon={<KeyboardIcon color={colors.magenta} />}
              onPress={handleScanText}
              accessibilityLabel="Registrar una comida escribiéndola"
            />
          </View>

          {searchMode ? (
            <TextInput
              ref={searchRef}
              style={styles.searchField}
              value={name}
              onChangeText={setName}
              placeholder="Busca o agrega una comida…"
              placeholderTextColor={colors.niebla}
              autoCorrect={false}
              returnKeyType="next"
            />
          ) : null}

          {searchMode && composing && !exactMatch ? (
            <View style={styles.editor}>
              <View style={styles.editorHead}>
                <EyebrowLabel tone="magenta" size={10}>
                  Nueva comida
                </EyebrowLabel>
                <StarPreview progress={previewProgress} valid={manualValid} />
              </View>
              <Text style={styles.newName} numberOfLines={1}>
                {name.trim()}
              </Text>
              <Text style={styles.newHint}>
                Aún no está en tu cielo. Asígnale su proteína y calorías.
              </Text>

              <View style={styles.numberRow}>
                <View style={styles.fieldCol}>
                  <EyebrowLabel tone="niebla" size={9} style={styles.fieldLabel}>
                    Proteína
                  </EyebrowLabel>
                  <View style={styles.numberField}>
                    <TextInput
                      style={styles.numberInput}
                      value={protein}
                      onChangeText={setProtein}
                      placeholder="0"
                      placeholderTextColor={colors.bruma}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                    <Text style={styles.numberUnit}>g</Text>
                  </View>
                </View>
                <View style={styles.fieldCol}>
                  <EyebrowLabel tone="niebla" size={9} style={styles.fieldLabel}>
                    Calorías
                  </EyebrowLabel>
                  <View style={styles.numberField}>
                    <TextInput
                      style={styles.numberInput}
                      value={calories}
                      onChangeText={setCalories}
                      placeholder="0"
                      placeholderTextColor={colors.bruma}
                      keyboardType="numeric"
                      returnKeyType="done"
                    />
                    <Text style={styles.numberUnit}>kcal</Text>
                  </View>
                </View>
              </View>

              {photoUri ? (
                <Pressable
                  onPress={photoOptions}
                  style={styles.photoRow}
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar o quitar la foto del platillo"
                >
                  <Image source={{ uri: photoUri }} style={styles.photoThumb} resizeMode="cover" />
                  <Text style={styles.photoRowText}>Foto añadida · toca para cambiar</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={photoOptions}
                  style={styles.photoPlaceholder}
                  accessibilityRole="button"
                  accessibilityLabel="Agregar una foto del platillo"
                >
                  <CameraIcon color={colors.magenta} />
                  <Text style={styles.photoPlaceholderText}>Agregar foto</Text>
                </Pressable>
              )}

              <PrimaryCta
                label={submitting ? 'Sumando…' : 'Sumar al cielo'}
                variant="soft"
                onPress={handleAddManual}
                disabled={!manualValid || submitting}
                marginTop={14}
                accessibilityLabel="Registrar comida nueva"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── §3 · Tus Aliados ── */}
      <View style={styles.aliadosHead}>
        <EyebrowLabel tone="magenta" size={10}>
          {hasAliados ? 'Tus Aliados' : 'Tus Comidas'}
        </EyebrowLabel>
      </View>
      <Text style={styles.aliadosSub}>
        {hasAliados
          ? 'Las comidas que más impulsan tu transformación.'
          : 'Las que más repitas se vuelven tus aliadas.'}
      </Text>

      <View style={styles.list}>
        {visible.map((item, i) => (
          <AllyCard
            key={item.name}
            name={item.name}
            protein={item.protein_g}
            freq={item.freq}
            photoPath={item.photo_storage_path}
            rank={composing || !hasAliados ? 99 : i}
            confirmed={confirmed === item.name}
            onRepeat={() => handleRepeat(item)}
            onOpen={() => onOpenMeal(item.id, item.photo_storage_path ?? undefined)}
          />
        ))}

        {history.length === 0 ? (
          <Text style={styles.emptyHint}>
            {composing
              ? 'Nada con ese nombre, créala arriba.'
              : 'Aún no tienes aliados. La comida que registres aparecerá aquí.'}
          </Text>
        ) : null}
      </View>

      {collapsible ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={styles.showMore}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Mostrar menos aliados' : 'Mostrar todos tus aliados'}
        >
          <Text style={styles.showMoreText}>
            {expanded ? 'Ver menos' : `Ver todos · ${history.length}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // §4 · bloque de registro desplegable.
  registro: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  registroTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
  },
  // "Como ayer" — el atajo de un tap, misma vestimenta de card que las tiles.
  comoAyer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgCard2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  comoAyerText: {
    flex: 1,
    gap: 2,
  },
  comoAyerLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  comoAyerName: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  comoAyerChevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
  methods: {
    flexDirection: 'row',
    gap: 10,
  },
  methodHit: {
    flex: 1,
  },
  method: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.magentaTint2,
    backgroundColor: colors.magentaTint,
  },
  methodActive: {
    borderColor: colors.magenta,
    backgroundColor: colors.magentaTint2,
  },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magentaTint2,
  },
  methodLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    letterSpacing: 0.3,
  },
  searchField: {
    height: 46,
    marginTop: 12,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 11,
    paddingHorizontal: 13,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  // §3 · Tus Aliados.
  aliadosHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 24,
  },
  aliadosSub: {
    marginTop: 4,
    marginBottom: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
  list: {
    gap: 10,
  },
  emptyHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    paddingVertical: 10,
  },
  showMore: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  showMoreText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  // Editor de nueva comida.
  editor: {
    marginTop: 12,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    padding: 14,
  },
  editorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  newName: {
    fontFamily: typography.displaySemi,
    fontSize: 19,
    color: colors.leche,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  newHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginTop: 3,
    marginBottom: 14,
  },
  numberRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldCol: {
    flex: 1,
  },
  fieldLabel: {
    marginLeft: 2,
    marginBottom: 6,
  },
  numberField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  numberInput: {
    flex: 1,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  numberUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  photoPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    marginTop: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  photoThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  photoRowText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  previewWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGlow: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.magentaTint2,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 7,
    elevation: 3,
  },
})
