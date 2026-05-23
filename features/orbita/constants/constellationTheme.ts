import { colors } from '@/theme'

/*
 * Constellation animation theme — one place to tune every layer of
 * the Día hero's motion. Three intensity profiles (`low | medium |
 * high`) gate amplitudes + speeds; `reducedMotion` collapses
 * everything to a static-or-near-static fallback.
 *
 * Used by:
 *   • AnimatedConstellation  — energy-flow opacity + cadence
 *   • CosmicParticles        — particle count + drift speed
 *   • OrbitalSystem StarNode — slow respiration of bloom + opacity
 *   • DimensionNodeList      — selected-badge pulse
 */

export type ConstellationIntensity = 'low' | 'medium' | 'high'

export const CONSTELLATION_COLORS = {
  /** The base line + ornamental stroke. */
  line: colors.magenta,
  /** The bright highlight that travels along the connecting lines. */
  lineFlow: '#FBD7E3',
  /** Bloom halo behind a luminous star. */
  starHalo: colors.magenta,
  /** Star core (the bright point). */
  starCore: '#FFFFFF',
  /** Particle / dust colour for the cosmic backdrop. */
  particle: colors.leche,
} as const

export type ConstellationProfile = {
  // Capa 1 — star pulse (the StarNode breath: scale + opacity dip).
  pulseScale: number
  pulseOpacity: number
  // Capa 2 — slow respirating glow behind active stars. Separate
  // from the existing breath; runs on its own slow clock.
  glowMinScale: number
  glowMaxScale: number
  glowMinOpacity: number
  glowMaxOpacity: number
  glowDurationMs: number
  // Capa 3 — energy flow along the eight main constellation lines.
  flowEnabled: boolean
  flowDurationMs: number
  flowOpacity: number
  /** Fraction of the path (0–1) covered by the bright dash. */
  flowDashLength: number
  // Capa 4 — background particles.
  particleCount: number
  particleDriftMs: number
  particleOpacity: number
  // Capa 5 — nebula slow breath (handled by Cosmos.tsx internally).
  nebulaBreathScale: number
  nebulaBreathOpacity: number
  nebulaDurationMs: number
  // Capa 6 — selected-badge pulse (DimensionNodeList).
  badgePulseScale: number
  badgePulseOpacity: number
  badgePulseDurationMs: number
}

const PROFILES: Record<ConstellationIntensity, ConstellationProfile> = {
  low: {
    pulseScale: 0.04,
    pulseOpacity: 0.1,
    glowMinScale: 0.96,
    glowMaxScale: 1.06,
    glowMinOpacity: 0.16,
    glowMaxOpacity: 0.3,
    glowDurationMs: 10000,
    flowEnabled: false,
    flowDurationMs: 7000,
    flowOpacity: 0.4,
    flowDashLength: 0.12,
    particleCount: 8,
    particleDriftMs: 60000,
    particleOpacity: 0.35,
    nebulaBreathScale: 0.04,
    nebulaBreathOpacity: 0.05,
    nebulaDurationMs: 14000,
    badgePulseScale: 0.02,
    badgePulseOpacity: 0.04,
    badgePulseDurationMs: 3800,
  },
  medium: {
    pulseScale: 0.08,
    pulseOpacity: 0.18,
    glowMinScale: 0.9,
    glowMaxScale: 1.14,
    glowMinOpacity: 0.22,
    glowMaxOpacity: 0.46,
    glowDurationMs: 7500,
    flowEnabled: true,
    flowDurationMs: 5400,
    flowOpacity: 0.6,
    flowDashLength: 0.16,
    particleCount: 14,
    particleDriftMs: 45000,
    particleOpacity: 0.55,
    nebulaBreathScale: 0.08,
    nebulaBreathOpacity: 0.1,
    nebulaDurationMs: 11000,
    badgePulseScale: 0.04,
    badgePulseOpacity: 0.1,
    badgePulseDurationMs: 3000,
  },
  high: {
    pulseScale: 0.14,
    pulseOpacity: 0.28,
    glowMinScale: 0.86,
    glowMaxScale: 1.32,
    glowMinOpacity: 0.3,
    glowMaxOpacity: 0.62,
    glowDurationMs: 5500,
    flowEnabled: true,
    flowDurationMs: 4000,
    flowOpacity: 0.78,
    flowDashLength: 0.2,
    particleCount: 18,
    particleDriftMs: 36000,
    particleOpacity: 0.7,
    nebulaBreathScale: 0.14,
    nebulaBreathOpacity: 0.16,
    nebulaDurationMs: 9000,
    badgePulseScale: 0.06,
    badgePulseOpacity: 0.16,
    badgePulseDurationMs: 2400,
  },
}

/**
 * Pulls the profile for an intensity, OR collapses every motion
 * range to zero when the OS-level reduceMotion flag is on. Particles
 * still render as static dots in that mode (`particleDriftMs:
 * Infinity` is the sentinel the component uses to skip its clock).
 */
export function getConstellationProfile(
  intensity: ConstellationIntensity,
  reducedMotion: boolean,
): ConstellationProfile {
  const base = PROFILES[intensity]
  if (!reducedMotion) return base
  return {
    ...base,
    pulseScale: 0,
    pulseOpacity: 0,
    glowMinScale: 1,
    glowMaxScale: 1,
    flowEnabled: false,
    nebulaBreathScale: 0,
    nebulaBreathOpacity: 0,
    badgePulseScale: 0,
    badgePulseOpacity: 0,
    particleDriftMs: Number.POSITIVE_INFINITY,
  }
}
