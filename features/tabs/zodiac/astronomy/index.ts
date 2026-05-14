// Real-sky data — Hipparcos coordinates + magnitudes + projection
// helpers. Not consumed by the visible constellation today (that
// path renders hand-positioned stylised figures from `../figures`).
// Kept around for a future detail / accurate-sky view.
export {
  boundingBox,
  celestialCentroid,
  fitToUnitSquare,
  magnitudeToRadius,
  projectEquirectangular,
  unwrapRightAscension,
  type BoundingBox,
  type CelestialStar,
  type FitOptions,
  type Vec2,
} from './project'
export { SKY_DATA, type SkyConstellation } from './skyData'
