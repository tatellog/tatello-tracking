import { ZODIAC } from '../../../../zodiac/data'
import { TARGET_DAYS } from '../../constants'
import { buildFieldStars, deriveProgress } from '../derive-progress'

function trainedOf(count: number): boolean[] {
  return Array.from({ length: 28 }, (_, i) => i < count)
}

describe('deriveProgress', () => {
  it('reports zero state when nothing is marked', () => {
    const result = deriveProgress(trainedOf(0), 0, ZODIAC.aries)
    expect(result.trainedCount).toBe(0)
    expect(result.elementsLit).toBe(0)
    expect(result.isComplete).toBe(false)
    expect(result.intensity).toBe(0)
  })

  it('reports complete when every day is marked', () => {
    const result = deriveProgress(trainedOf(28), 27, ZODIAC.aries)
    expect(result.trainedCount).toBe(28)
    expect(result.isComplete).toBe(true)
    expect(result.elementsLit).toBe(Math.min(28, result.sequence.length))
  })

  it('pads the sequence to TARGET_DAYS with field stars', () => {
    // Aries has 6 stars + 5 lines = 11 figure elements; padding fills
    // the remaining 17 so the cycle always spans TARGET_DAYS.
    const result = deriveProgress(trainedOf(0), 0, ZODIAC.aries)
    expect(result.sequence).toHaveLength(TARGET_DAYS)
    const figureCount = result.sequence.filter((el) => el.type !== 'field').length
    const fieldCount = result.sequence.filter((el) => el.type === 'field').length
    expect(figureCount).toBe(ZODIAC.aries.stars.length + ZODIAC.aries.lines.length)
    expect(figureCount + fieldCount).toBe(TARGET_DAYS)
  })

  it('front-loads the figure — all figure elements precede any field star', () => {
    const result = deriveProgress(trainedOf(0), 0, ZODIAC.aries)
    const firstField = result.sequence.findIndex((el) => el.type === 'field')
    let lastFigure = -1
    for (let i = result.sequence.length - 1; i >= 0; i--) {
      if (result.sequence[i]!.type !== 'field') {
        lastFigure = i
        break
      }
    }
    // The figure leads; "luz extra" field stars only come after it.
    expect(lastFigure).toBeLessThan(firstField)
    expect(lastFigure).toBe(result.figureCount - 1)
  })

  it('completes the FIGURE at figureCount, not the whole month', () => {
    const fc = ZODIAC.aries.stars.length + ZODIAC.aries.lines.length // 11
    const justBefore = deriveProgress(trainedOf(fc - 1), fc - 2, ZODIAC.aries, 30)
    expect(justBefore.figureComplete).toBe(false)
    const atGoal = deriveProgress(trainedOf(fc), fc - 1, ZODIAC.aries, 30)
    expect(atGoal.figureComplete).toBe(true)
    expect(atGoal.figureCount).toBe(fc)
    expect(atGoal.extraLit).toBe(0)
    // A rest-friendly goal: well under a 30-day month.
    expect(fc).toBeLessThan(30)
  })

  it('counts days beyond the figure as luz extra', () => {
    const fc = ZODIAC.aries.stars.length + ZODIAC.aries.lines.length
    const trained = Array.from({ length: 30 }, (_, i) => i < fc + 4)
    const result = deriveProgress(trained, 29, ZODIAC.aries, 30)
    expect(result.figureComplete).toBe(true)
    expect(result.extraLit).toBe(4)
  })

  it('keeps sequence + fieldStars stable across trained changes', () => {
    // The trained array influences only trainedCount/elementsLit; the
    // sequence and field scatter depend purely on the zodiac shape.
    const a = deriveProgress(trainedOf(0), 0, ZODIAC.aries)
    const b = deriveProgress(trainedOf(28), 27, ZODIAC.aries)
    expect(a.sequence).toEqual(b.sequence)
    expect(a.fieldStars).toEqual(b.fieldStars)
  })

  it('drops trainedCount on undo without disturbing the sequence', () => {
    const trained = trainedOf(2)
    const beforeUndo = deriveProgress(trained, 5, ZODIAC.aries)
    const undone = [...trained]
    undone[1] = false
    const afterUndo = deriveProgress(undone, 5, ZODIAC.aries)
    expect(beforeUndo.trainedCount).toBe(2)
    expect(afterUndo.trainedCount).toBe(1)
    expect(beforeUndo.sequence).toEqual(afterUndo.sequence)
    expect(beforeUndo.fieldStars).toEqual(afterUndo.fieldStars)
  })

  it('snapshot — aries · 7 marked · todayIdx 7', () => {
    expect(deriveProgress(trainedOf(7), 7, ZODIAC.aries)).toMatchSnapshot()
  })
})

describe('buildFieldStars', () => {
  it('returns the requested count when nothing collides', () => {
    expect(buildFieldStars([], 10)).toHaveLength(10)
  })

  it('returns an empty array for count=0', () => {
    expect(buildFieldStars([], 0)).toEqual([])
  })

  it('avoids the canvas centre where the chip lives', () => {
    for (const fs of buildFieldStars([], 20)) {
      const dx = fs.x - 0.5
      const dy = fs.y - 0.5
      expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(0.21 * 0.21)
    }
  })

  it('skips slots that sit on top of figure stars', () => {
    // Picked a coord outside the centre exclusion so the collision
    // check is the only thing keeping field stars away from it.
    const figureStars = [{ x: 0.2, y: 0.2 }]
    for (const fs of buildFieldStars(figureStars, 10)) {
      const ex = fs.x - 0.2
      const ey = fs.y - 0.2
      expect(ex * ex + ey * ey).toBeGreaterThanOrEqual(0.065 * 0.065)
    }
  })

  it('is deterministic across calls', () => {
    expect(buildFieldStars([], 8)).toEqual(buildFieldStars([], 8))
  })
})
