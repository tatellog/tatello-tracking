import { buildDayVoice } from '../logic'
import { mkSig, STRONG } from './signals.fixture'

/*
 * Voz de Stelar (Órbita Día, PRD V1) — observación FACTUAL de hoy.
 * Verifica: frase 1 = qué registré, frase 2 = qué falta (en calma), y
 * que NUNCA aparezca lenguaje de historial/tendencia.
 */

const DAY = '2026-06-13'

// Palabras que el PRD prohíbe (piden historial) + comparaciones temporales.
const FORBIDDEN = /suele|normalmente|generalmente|habitual|siempre|semana|tendencia/i

function voiceFor(o: Parameters<typeof mkSig>[1]) {
  return buildDayVoice(mkSig(DAY, o), { cycleEnabled: false })
}

describe('buildDayVoice — registrado', () => {
  it('nombra el sueño y la energía registrados, en pasado factual', () => {
    const voz = voiceFor({ sleep_minutes: 468, energy: 5 })
    expect(voz.registered).toMatch(/dormiste/i)
    expect(voz.registered).toMatch(/energía alta/i)
  })

  it('mapea el nivel de energía a baja/media/alta', () => {
    expect(voiceFor({ energy: 1 }).registered).toMatch(/energía baja/i)
    expect(voiceFor({ energy: 3 }).registered).toMatch(/energía media/i)
    expect(voiceFor({ energy: 5 }).registered).toMatch(/energía alta/i)
  })

  it('un día muy registrado lista varias señales y no deja faltante', () => {
    const voz = voiceFor(STRONG)
    expect(voz.registered).toMatch(/dormiste/i)
    expect(voz.registered).toMatch(/comidas/i)
    expect(voz.missing).toBeNull()
  })

  it('sin ninguna señal → una sola línea en calma, sin faltante inventado', () => {
    const voz = voiceFor({})
    expect(voz.registered).toBe('Tu cielo de hoy aún está en calma.')
    expect(voz.missing).toBeNull()
  })
})

describe('buildDayVoice — faltante (qué me falta), en calma', () => {
  it('nombra lo no registrado como "aún no aparece", nunca como falla', () => {
    const voz = voiceFor({ sleep_minutes: 468, energy: 5 })
    expect(voz.missing).toBeTruthy()
    expect(voz.missing).toMatch(/aún no aparece/i)
    expect(voz.missing).not.toMatch(/te falta|olvidaste|no registraste|fallaste/i)
  })

  it('con muchas dimensiones en silencio, resume "el resto sigue en calma"', () => {
    // Solo una comida → solo alimento se enciende; el resto queda en calma.
    const voz = voiceFor({ meal_count: 2 })
    expect(voz.missing).toMatch(/el resto de tu cielo sigue en calma/i)
  })
})

describe('buildDayVoice — reglas del PRD (sin historial ni tendencias)', () => {
  it('ninguna salida usa palabras prohibidas', () => {
    for (const o of [
      {},
      STRONG,
      { energy: 1, sleep_minutes: 300 },
      { meal_count: 1 },
      {
        trained: true,
        energy: 4,
      },
    ]) {
      const voz = voiceFor(o)
      expect(voz.registered).not.toMatch(FORBIDDEN)
      if (voz.missing) expect(voz.missing).not.toMatch(FORBIDDEN)
    }
  })
})
