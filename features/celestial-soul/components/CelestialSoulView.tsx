import { useMemo } from 'react'
import {
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import type { ZodiacSign } from '@/features/tabs/zodiac/types'

import { soulConfigForSign } from '../config'
import { computeSoulProgress } from '../logic'
import { SOUL_ART } from '../soulArt'
import { ConstelacionesOcultas } from './regions/ConstelacionesOcultas'
import { GeometriaSagrada } from './regions/GeometriaSagrada'
import { HaloCosmico } from './regions/HaloCosmico'
import { NucleoAstral } from './regions/NucleoAstral'
import { OrbitasEternas } from './regions/OrbitasEternas'

/*
 * Hero del Alma Celeste — para el Tab Hoy (tamaño EMBLEMA, no full-screen). La
 * FIGURA ya está completa y SIEMPRE visible: es el ARTE del Alma Celeste del
 * signo. Lo que despierta son los 6 SISTEMAS alrededor (cada uno un efecto
 * visual en SU ubicación). Hoy solo está vivo el Núcleo Astral; los demás se
 * montan como slices encima.
 *
 * Los visuales se colocan por GEOMETRÍA (centro/radio/fondo) + el % de su
 * región — NO por las coords placeholder de los nodos (esas solo cuentan al %).
 */

/** Opacidad de la figura al 0 % (alma recién naciendo). Sube linealmente a 1.0
 *  al 100 %. Editable si querés un fantasma más/menos tenue al inicio. */
const SOUL_BASE_OPACITY = 0.35

type Props = {
  sign: ZodiacSign
  revealedIds: readonly string[]
  /** Lado del hero en px. Default = tamaño emblema. */
  size?: number
  style?: StyleProp<ViewStyle>
}

export function CelestialSoulView({ sign, revealedIds, size, style }: Props) {
  const { width } = useWindowDimensions()
  const heroSize = size ?? Math.min(width - 96, 300)

  const config = useMemo(() => soulConfigForSign(sign), [sign])
  const revealed = useMemo(() => new Set(revealedIds), [revealedIds])
  const progress = useMemo(() => computeSoulProgress(config, revealed), [config, revealed])

  // Opacidad PROGRESIVA de la figura: tenue al nacer (0 %) → sólida al 100 %.
  // El piso la mantiene visible desde el inicio (un alma que despierta, no un
  // vacío); a despertar completo es 1.0 (sin atenuar).
  const artOpacity = SOUL_BASE_OPACITY + (1 - SOUL_BASE_OPACITY) * (progress.pct / 100)

  const nucleo = useMemo(() => {
    const ns = config.nodes.filter((n) => n.region === 'nucleo')
    if (ns.length === 0) return null
    const cx = ns.reduce((a, n) => a + n.x, 0) / ns.length
    const cy = ns.reduce((a, n) => a + n.y, 0) / ns.length
    const pct = progress.regions.find((r) => r.key === 'nucleo')?.pct ?? 0
    return { cx, cy, pct }
  }, [config.nodes, progress.regions])

  // Sistemas que se colocan por geometría (no necesitan centroide de nodos).
  const orbitasPct = progress.regions.find((r) => r.key === 'orbitas')?.pct ?? 0
  const constelacionesPct = progress.regions.find((r) => r.key === 'constelaciones')?.pct ?? 0
  const haloPct = progress.regions.find((r) => r.key === 'halo')?.pct ?? 0
  const geometriaPct = progress.regions.find((r) => r.key === 'geometria')?.pct ?? 0

  return (
    <View style={[styles.hero, { width: heroSize, height: heroSize }, style]}>
      {/* El Alma Celeste — la figura ya completa y visible (mismo patrón de
          Image que la ceremonia, que renderiza todos los signos bien). */}
      <Image
        source={SOUL_ART[sign]}
        style={{ width: heroSize, height: heroSize, opacity: artOpacity }}
        resizeMode="contain"
      />

      {/* ── Sistemas VIVOS (entorno → centro) ── Cada uno se MONTA solo si su
          región empezó a despertar (>0%). Así una región dormida no corre loops
          ni worklets — clave porque las usuarias arrancan con todo a 0%. */}
      {haloPct > 0 ? <HaloCosmico artSize={heroSize} pct={haloPct} /> : null}
      {constelacionesPct > 0 ? (
        <ConstelacionesOcultas artSize={heroSize} pct={constelacionesPct} />
      ) : null}
      {orbitasPct > 0 ? <OrbitasEternas artSize={heroSize} pct={orbitasPct} /> : null}
      {geometriaPct > 0 ? <GeometriaSagrada artSize={heroSize} pct={geometriaPct} /> : null}
      {/* Flujo Estelar (movimiento del cabello) removido por decisión de diseño —
          el componente y el node-map por signo quedan dormidos en el repo
          (regions/FlujoEstelar.tsx + flujoStreamsForSign) por si se retoma. */}
      {nucleo && nucleo.pct > 0 ? (
        <NucleoAstral cx={nucleo.cx} cy={nucleo.cy} artSize={heroSize} pct={nucleo.pct} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 16,
  },
})
