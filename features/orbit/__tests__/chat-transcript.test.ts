import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CHAT_PROMPT_VERSION, FindingTranscriptSchema, makeTranscript } from '../chat-transcript'

/*
 * El transcript se cachea keyed por CHAT_PROMPT_VERSION (espejo del
 * PROMPT_VERSION del edge stelar-insight). Si el prompt del edge sube y el
 * espejo no, se rehidrataría copy viejo. Este test los amarra: lee el valor real
 * del edge y exige que coincidan. Mismo patrón que el "hash dorado".
 */
describe('CHAT_PROMPT_VERSION — espejo del edge', () => {
  it('coincide con PROMPT_VERSION de stelar-insight', () => {
    const edge = readFileSync(
      join(__dirname, '../../../supabase/functions/stelar-insight/index.ts'),
      'utf8',
    )
    const m = edge.match(/PROMPT_VERSION\s*=\s*'([^']+)'/)
    expect(m).not.toBeNull()
    expect(CHAT_PROMPT_VERSION).toBe(m![1])
  })
})

describe('FindingTranscriptSchema — persistencia del render', () => {
  const valid = makeTranscript({
    log: [
      { who: 'stelar', text: 'Los días que te moviste, sostuviste el déficit.', voice: true },
      { who: 'user', label: '¿Y los días que no?' },
      { who: 'stelar', text: 'Esos días casi no aparece.' },
    ],
    chips: ['¿Es casualidad?'],
    phase: 'closing',
    focus: 'muévete los días flojos',
    metaAnswer: null,
    path: ['¿Y los días que no?'],
  })

  it('acepta un transcript bien formado (roundtrip)', () => {
    const parsed = FindingTranscriptSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
  })

  it('rechaza un shape viejo/ajeno (→ miss → flujo fresco)', () => {
    expect(FindingTranscriptSchema.safeParse({ log: [], foo: 1 }).success).toBe(false)
    // Sin la versión de schema (guardado por una app previa) → miss.
    const { v: _v, ...noVersion } = valid
    expect(FindingTranscriptSchema.safeParse(noVersion).success).toBe(false)
  })

  it('exige al menos una burbuja (nunca persiste vacío)', () => {
    expect(FindingTranscriptSchema.safeParse({ ...valid, log: [] }).success).toBe(false)
  })
})
