import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { IgnitionBurst, IGNITION_LIFETIME_MS } from '@/features/tabs/components/IgnitionBurst'
import { SkyBackground, UniverseDeltaToast } from '@/features/tabs/components'
import {
  FlightToConstellation,
  ParticleBurst,
} from '@/features/tabs/components/TodayUniverseRewards'
import { emitUniverseDelta } from '@/features/tabs/universe-delta-bus'
import { ATTRIBUTE_LABEL, type UniverseAttributeKey } from '@/features/tabs/universe-rewards'
import { UNIVERSE_ACCENT } from '@/features/tabs/universe-visuals'
import { colors, typography } from '@/theme'

/*
 * Dev-only — playground del sistema de recompensas. Cada animación tiene
 * un botón que la dispara, reusando el COMPONENTE REAL (no una copia)
 * para que el playground valide lo que se ve en producción:
 *
 *   · Toast "+N atributo"  → UniverseDeltaToast (vía el delta-bus)
 *   · Ignición en el toque → IgnitionBurst
 *   · Estallido al completar → ParticleBurst
 *   · Vuelo a la constelación → FlightToConstellation
 *
 * El emblema por % y la constelación por entrenos viven en su propio
 * catálogo (/dev-emblem-stages), enlazado abajo.
 *
 * Route: /dev-rewards
 */

const STAGE_W = Dimensions.get('window').width - 40
const STAGE_H = 190

type Attr = { key: UniverseAttributeKey; label: string }
const ATTRS: readonly Attr[] = [
  { key: 'energia', label: ATTRIBUTE_LABEL.energia },
  { key: 'claridad', label: ATTRIBUTE_LABEL.claridad },
  { key: 'estabilidad', label: ATTRIBUTE_LABEL.estabilidad },
  { key: 'brillo', label: ATTRIBUTE_LABEL.brillo },
] as const

/* Una fila de chips, uno por atributo, tintado de su acento. */
function AttrChips({ onPick }: { onPick: (a: Attr) => void }) {
  return (
    <View style={styles.chips}>
      {ATTRS.map((a) => {
        const accent = UNIVERSE_ACCENT[a.key]
        return (
          <Pressable
            key={a.key}
            onPress={() => onPick(a)}
            accessibilityRole="button"
            accessibilityLabel={`Disparar ${a.label}`}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: `${accent}59` },
              pressed && styles.chipPressed,
            ]}
          >
            <View style={[styles.chipDot, { backgroundColor: accent }]} />
            <Text style={[styles.chipText, { color: accent }]}>{a.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function DevRewardsScreen() {
  const router = useRouter()
  const seq = useRef(0)

  // Cada recompensa: un payload con id (la key que re-monta y re-dispara
  // la animación) + el atributo elegido. Se limpia tras su vida útil.
  const [toastHint, setToastHint] = useState(false)
  const [ign, setIgn] = useState<{ id: number; color: string } | null>(null)
  const [burst, setBurst] = useState<{ id: number; color: string } | null>(null)
  const [flight, setFlight] = useState<{ id: number; key: UniverseAttributeKey } | null>(null)

  const fireToast = (a: Attr) => {
    setToastHint(true)
    // delta fijo 13 — el toast acumula si lo tocas seguido (mismo atributo).
    emitUniverseDelta({ key: a.key, delta: 13 })
  }

  const fireIgnition = (a: Attr) => {
    // La ignición vibra (impact) — en producción la dispara el tap de
    // agua; aquí la replicamos para sentir la recompensa al probar.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    const id = ++seq.current
    setIgn({ id, color: UNIVERSE_ACCENT[a.key] })
    setTimeout(() => setIgn((c) => (c?.id === id ? null : c)), IGNITION_LIFETIME_MS)
  }

  const fireBurst = (a: Attr) => {
    // Completar un atributo vibra Success (igual que en "Tu universo hoy").
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    const id = ++seq.current
    setBurst({ id, color: UNIVERSE_ACCENT[a.key] })
    setTimeout(() => setBurst((c) => (c?.id === id ? null : c)), 1700)
  }

  const fireFlight = (a: Attr) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    const id = ++seq.current
    setFlight({ id, key: a.key })
    setTimeout(() => setFlight((c) => (c?.id === id ? null : c)), 1900)
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DevBackButton />
        <View style={styles.header}>
          <Text style={styles.title}>Test · sistema de recompensas</Text>
          <Text style={styles.subtitle}>Toca un atributo para ver cada animación</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ── Toast "+N atributo" ── */}
          <View style={styles.reward}>
            <Text style={styles.rewardTitle}>Toast de atributo</Text>
            <Text style={styles.rewardDesc}>
              El “+N” que aparece al registrar. Tócalo dos veces seguidas (mismo atributo) para ver
              la acumulación (+13 → +26). Sale abajo, sobre la barra.
            </Text>
            <AttrChips onPick={fireToast} />
            {toastHint ? <Text style={styles.hint}>↓ míralo abajo</Text> : null}
          </View>

          {/* ── Ignición en el toque ── */}
          <View style={styles.reward}>
            <Text style={styles.rewardTitle}>Ignición en el toque</Text>
            <Text style={styles.rewardDesc}>
              La corona de luz + chispas que nacen del dedo al registrar agua/comida, dentro del
              QuickLog.
            </Text>
            <View style={styles.stage}>
              {ign ? (
                <IgnitionBurst key={ign.id} x={STAGE_W / 2} y={STAGE_H - 40} color={ign.color} />
              ) : null}
            </View>
            <AttrChips onPick={fireIgnition} />
          </View>

          {/* ── Estallido al completar ── */}
          <View style={styles.reward}>
            <Text style={styles.rewardTitle}>Estallido al completar</Text>
            <Text style={styles.rewardDesc}>
              Las partículas que brotan de un atributo cuando se completa (100%) en “Tu universo
              hoy”.
            </Text>
            <View style={styles.stage}>
              {burst ? (
                <View style={styles.burstAnchor}>
                  <ParticleBurst key={burst.id} color={burst.color} />
                </View>
              ) : null}
            </View>
            <AttrChips onPick={fireBurst} />
          </View>

          {/* ── Vuelo a la constelación ── */}
          <View style={styles.reward}>
            <Text style={styles.rewardTitle}>Vuelo a la constelación</Text>
            <Text style={styles.rewardDesc}>
              Las chispas que salen del atributo y vuelan hacia el hero de Leo — la cadena registro
              → cielo.
            </Text>
            <View style={styles.stage}>
              {/* index 2 = cuadrante inferior, para que el vuelo arranque
                  abajo del escenario y se vea subir. */}
              {flight ? (
                <FlightToConstellation key={flight.id} attrKey={flight.key} index={2} />
              ) : null}
            </View>
            <AttrChips onPick={fireFlight} />
          </View>

          {/* ── Enlaces a otros catálogos ── */}
          <Pressable
            onPress={() => router.push('/dev-emblem-stages')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkRow, pressed && styles.chipPressed]}
          >
            <Text style={styles.linkText}>Emblema por % · constelación por entrenos</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* El toast real, montado aquí para que el delta-bus tenga oyente en
          esta ruta (el global vive en el tabs layout, no en /dev-*). */}
      <UniverseDeltaToast />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  reward: {
    marginBottom: 26,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rewardTitle: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  rewardDesc: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginTop: 6,
  },
  // El escenario donde se reproduce cada animación.
  stage: {
    height: STAGE_H,
    marginTop: 14,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  // ParticleBurst sube desde el TOP de su contenedor; lo anclo cerca del
  // fondo del escenario para que las partículas suban dentro de la vista.
  burstAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    height: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  chipPressed: { opacity: 0.6 },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.2,
  },
  hint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.bruma,
    marginTop: 10,
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 174, 111, 0.4)',
    backgroundColor: 'rgba(217, 174, 111, 0.06)',
  },
  linkText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    letterSpacing: 0.4,
  },
  linkChevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.segmentTitle,
    color: colors.niebla,
  },
})
