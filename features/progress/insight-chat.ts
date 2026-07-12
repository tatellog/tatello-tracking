/*
 * Epic 04 · Guided Insight Conversations — el ADAPTADOR que permite reutilizar
 * TODA la infraestructura de chat de Órbita para los insights de Progress.
 *
 * Un `ProgressInsight` (Epic 03) se viste como `Finding` y entra tal cual a
 * `MonthChatSheet`/`FindingChatView`: mismo chat guiado, misma persistencia de
 * transcript (rehidrata sin red), mismos backstops del edge (anti-alucinación
 * de números, anti-hedge, anti-clínico). CERO cambios al edge: la rama
 * `orbita_mes_chat` conversa sobre un finding-shape genérico, y el caché no
 * colisiona con Órbita porque el período de Progress son fechas reales
 * (ventana rodante), no el monthKey.
 *
 * PURO y testeable. GPT solo explica; el insight ya viene detectado.
 */
import type { Finding } from '@/features/orbit/findings'

import type { ProgressInsight } from './insights'

/** Viste un insight de Progress como Finding para el chat guiado. Los campos
 *  que el chat no usa en Progress (metacognición apagada, sin palanca, sin
 *  días de evidencia) van vacíos a propósito — no inventamos contenido. */
export function insightToFinding(insight: ProgressInsight): Finding {
  return {
    id: insight.id,
    // 'deficit' = acento magenta neutro del chat (no hay categoría de dimensión
    // para métricas de cuerpo; el tint por categoría es solo visual).
    category: 'deficit',
    confidence: insight.confidence,
    title: insight.lead,
    subject: insight.subject,
    phrase: {
      lead: insight.lead,
      support: insight.support,
      // "No lo había notado" → por qué no se veía (el arco junto, no el día).
      caption: 'Un día no lo dice; el arco de semanas sí.',
    },
    contrast: insight.contrast ?? undefined,
    explanation: insight.northLink ?? insight.lead,
    northLink: insight.northLink ?? undefined,
    // Sin hypothesis ni lever: Progress muestra QUÉ cambió; el porqué y la
    // palanca viven en Órbita (línea divisoria del módulo).
    metric: { value: insight.support, label: 'de tus mediciones' },
    evidenceDates: [],
    evidenceTitle: '¿Por qué encontré esto?',
    charts: [],
    reflectionKey: `progress:${insight.id}`,
    metacognition: { question: '', options: [], replies: {} },
    followUps: [],
  }
}
