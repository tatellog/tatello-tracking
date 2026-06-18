// API pública del feature Alma Celeste.
export { CONSISTENCY_MILESTONES, SOUL_REGIONS, SOURCE_ACTION, soulConfigForSign } from './config'
export { RegionIcon } from './components/RegionIcon'
export { SoulMoment } from './components/SoulMoment'
export { SoulMomentHost } from './components/SoulMomentHost'
export { SoulRevealSync } from './components/SoulRevealSync'
export { SoulStageReveal } from './components/SoulStageReveal'
export {
  useCeremonySeen,
  useRevealSoulNode,
  useSoulFinalReveal,
  useSoulProgress,
  useSoulRegionReveal,
  useSoulRevealIds,
  useSoulRevealSync,
  useSoulRevealsTodaySources,
  useSoulStageReveal,
} from './hooks'
export {
  AWAKENING_LABEL,
  SOUL_MILESTONES,
  SOUL_STAGES,
  awakeningLevel,
  computeSoulProgress,
  litLineIndexes,
  milestoneCrossed,
  milestoneForPct,
  nextNodeForSource,
  regionsJustAwoke,
  stageCrossed,
  stageForPct,
} from './logic'
export { SOUL_ART } from './soulArt'
export type {
  AwakeningLevel,
  RegionProgress,
  RevealSource,
  SoulConfig,
  SoulMilestone,
  SoulNode,
  SoulProgress,
  SoulRegionDef,
  SoulRegionKey,
  SoulStage,
} from './types'
