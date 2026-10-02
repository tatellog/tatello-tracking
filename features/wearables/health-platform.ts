/*
 * La plataforma de salud del teléfono: HealthKit en iPhone, Health Connect en
 * Android. Expone los MISMOS nombres que healthkit.ts, así el sync
 * (hooks.ts), las tablas y la regla "manual gana" no saben de plataformas.
 * `HEALTH_SOURCE` es la procedencia que viaja a las filas wearable_*.
 */
import { Platform } from 'react-native'

import * as hc from './health-connect'
import * as hk from './healthkit'
import type { WearableSource } from './logic'

const android = Platform.OS === 'android'

export const HEALTH_SOURCE: WearableSource = android ? 'health_connect' : 'apple_health'

/** Cómo se llama la app de salud del teléfono en la UI. */
export const HEALTH_APP_NAME = android ? 'Health Connect' : 'Salud'
/** Nombre completo (botones, títulos). */
export const HEALTH_APP_FULL = android ? 'Health Connect' : 'Apple Health'
/** Dónde revisar el permiso de Stelar. */
export const HEALTH_PERMISSION_PATH = android
  ? 'Health Connect → Permisos de apps → Stelar'
  : 'Salud → Stelar'

export const isHealthKitAvailable = android ? hc.isHealthConnectAvailable : hk.isHealthKitAvailable
export const requestHealthKitAuthorization = android
  ? hc.requestHealthConnectAuthorization
  : hk.requestHealthKitAuthorization
export const requestScaleAuthorization = android
  ? hc.requestHealthConnectScaleAuthorization
  : hk.requestScaleAuthorization
export const readWorkouts = android ? hc.readHcWorkouts : hk.readWorkouts
export const readSleepSamples = android ? hc.readHcSleepSamples : hk.readSleepSamples
export const readDailySteps = android ? hc.readHcDailySteps : hk.readDailySteps
export const readDailyWater = android ? hc.readHcDailyWater : hk.readDailyWater
export const readBodyMass = android ? hc.readHcBodyMass : hk.readBodyMass
export const readBodyComposition = android ? hc.readHcBodyComposition : hk.readBodyComposition

// Despertar en segundo plano / avisos en vivo: solo HealthKit los tiene. En
// Android el aviso sale de la tarea periódica (background-sync.ts).
export const enableHealthBackgroundDelivery = android
  ? async () => false
  : hk.enableHealthBackgroundDelivery
export const disableHealthBackgroundDelivery = android
  ? async () => {}
  : hk.disableHealthBackgroundDelivery
export const subscribeHealthChanges = android
  ? async (_onChange: () => void) => () => {}
  : hk.subscribeHealthChanges
