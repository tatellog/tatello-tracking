/*
 * El ADAPTADOR que lleva el patrón dominante de Órbita al chat guiado
 * ("✦ Quiero entenderlo"). Mismo patrón que Progreso (insight-chat.ts): el
 * combo (month-built.winningCombo) se viste como `Finding` y entra tal cual a
 * MonthChatSheet / FindingChatView: mismo chat, mismo transcript persistido,
 * mismos backstops del edge (anti-alucinación de números, anti-clínico). CERO
 * cambios al edge. La IA solo EXPLICA un patrón que el motor ya encontró.
 *
 * PURO y testeable.
 */
import { comboPhrase, type WinningCombo } from './month-built'
import type { Finding } from './findings'

/** Id estable del combo: sus señales ordenadas ("combo:cuerpo+sueno"). */
export function comboId(combo: WinningCombo): string {
  return `combo:${combo.signals
    .map((s) => s.key)
    .sort()
    .join('+')}`
}

/** Hash del chat (caché por contenido): cambia si el combo cambia de forma o de
 *  evidencia, así la conversación no rehidrata un transcript de otro patrón. */
export function comboChatHash(combo: WinningCombo): string {
  return `${comboId(combo)}:${combo.occurrences}:${combo.deficits}`
}

/** Viste el patrón dominante como Finding. `lever` = la palanca de esta semana
 *  que ya arma el motor (weeklyComboLever); la IA la viste, nunca la inventa. */
export function comboToFinding(combo: WinningCombo, lever?: string | null): Finding {
  const id = comboId(combo)
  const phrase = comboPhrase(combo)
  const confidence =
    combo.occurrences > 0 ? Math.round((combo.deficits / combo.occurrences) * 100) : 0
  return {
    id,
    category: 'deficit',
    confidence,
    title: phrase,
    subject: 'la combinación que más te sostiene',
    phrase: {
      lead: phrase,
      support: `Coincidieron ${combo.occurrences} días; ${combo.deficits} terminaron en déficit.`,
      caption: 'Un día no lo dice; al juntar tus días, aparece.',
    },
    explanation:
      'Estos hábitos coincidieron seguido en tus días en déficit. Esto llamó mi atención.',
    northLink: 'Y esos días te acercaron a tu objetivo.',
    lever: lever ?? undefined,
    metric: { value: `${combo.deficits} de ${combo.occurrences}`, label: 'días en déficit' },
    evidenceDates: [...combo.days],
    evidenceTitle: '¿Por qué encontré esto?',
    charts: [],
    reflectionKey: `orbita:${id}`,
    metacognition: {
      question: '¿Esto ya lo sabías?',
      options: [
        { label: 'Sí', answer: 'si' },
        { label: 'No', answer: 'no' },
        { label: 'Nunca lo había visto', answer: 'nunca' },
      ],
      replies: {
        si: 'Entonces ya lo venías leyendo. Aquí queda con tus propios días.',
        no: 'Se ve mejor con los días juntos: uno por uno pasa desapercibido.',
        nunca: 'Tú ya lo estabas haciendo. Solo que mirando un día no se veía.',
      },
    },
    followUps: [],
  }
}
