import { moonIllumination, moonPhase } from '../moonPhase'

describe('moonIllumination', () => {
  it('returns null when there is no reference', () => {
    expect(moonIllumination(84, null)).toBeNull()
    expect(moonIllumination(84, 0)).toBeNull()
    expect(moonIllumination(84, -10)).toBeNull()
  })

  it('is protein ÷ reference', () => {
    expect(moonIllumination(84, 112)).toBeCloseTo(0.75)
    expect(moonIllumination(56, 112)).toBeCloseTo(0.5)
  })

  it('never goes negative but can exceed 1 (a full moon, not an error)', () => {
    expect(moonIllumination(-5, 112)).toBe(0)
    expect(moonIllumination(140, 112)).toBeCloseTo(1.25)
  })
})

describe('moonPhase', () => {
  it('maps the canonical anchors to the right phase', () => {
    expect(moonPhase(0).key).toBe('nueva')
    expect(moonPhase(0.25).key).toBe('creciente')
    expect(moonPhase(0.5).key).toBe('cuarto')
    expect(moonPhase(0.75).key).toBe('gibosa') // the spec example: 84/112
    expect(moonPhase(1).key).toBe('llena')
  })

  it('treats reaching or passing the reference as full (celebrated, never scolded)', () => {
    expect(moonPhase(0.96).key).toBe('llena')
    expect(moonPhase(1.4).key).toBe('llena')
  })

  it('clamps negatives to luna nueva', () => {
    expect(moonPhase(-1).key).toBe('nueva')
  })

  it('captions are growth-framed (never deficit/guilt language)', () => {
    const captions = [0, 0.25, 0.5, 0.75, 1].map((f) => moonPhase(f).caption.toLowerCase())
    for (const c of captions) {
      expect(c).not.toMatch(/falta|pasaste|deber|mal|incomplet|fall/)
    }
  })
})
