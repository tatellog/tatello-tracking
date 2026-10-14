/*
 * Dónde se envían los eventos del recorrido de un hallazgo (ST-008). La
 * dedupe vive solo en el teléfono (AsyncStorage): si se pierde, lo peor es un
 * evento repetido ese día. Qué se manda y cuándo es puro (insight-events.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

import { track } from '@/lib/analytics'

import {
  insightKey,
  markSentToday,
  shouldSendToday,
  type DedupedInsightEvent,
  type InsightFrom,
  type InsightLedger,
  type InsightMeta,
  type InsightSurface,
  type InsightTarget,
} from './insight-events'

const storageKey = (uid: string) => `stelar.insight-events:${uid}`

async function read(uid: string): Promise<InsightLedger> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid))
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as InsightLedger) : {}
  } catch {
    return {}
  }
}

// En fila: dos envíos seguidos (Hoy y Descubre en el mismo render) no leen el
// mismo ledger viejo y mandan doble.
let queue: Promise<void> = Promise.resolve()

/** `insight_eligible` / `insight_presented`, una vez al día por llave. */
export function trackInsightOnce(
  uid: string,
  event: DedupedInsightEvent,
  meta: InsightMeta,
  today: string,
  surface?: InsightSurface,
): void {
  queue = queue
    .then(async () => {
      const key = insightKey(event, meta.finding_id, surface)
      const ledger = await read(uid)
      if (!shouldSendToday(ledger, key, today)) return
      await AsyncStorage.setItem(
        storageKey(uid),
        JSON.stringify(markSentToday(ledger, key, today)),
      ).catch(() => {})
      track(event, surface ? { ...meta, surface } : meta)
    })
    .catch(() => {})
}

/** Una apertura deliberada: cada una cuenta. */
export function trackInsightOpened(meta: InsightMeta, from: InsightFrom, target: InsightTarget) {
  track('insight_opened', { ...meta, from, target })
}
