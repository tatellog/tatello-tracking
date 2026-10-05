import { findingPushCopy, pickFindingToAnnounce } from '../finding-push'

// jest.mock se eleva antes del import: AsyncStorage no existe en node.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

const NOW = new Date('2026-10-05T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()
const inHours = (n: number) => new Date(NOW.getTime() + n * 3_600_000).toISOString()

const P = {
  movement: { id: 'movement-deficit', title: 'Entreno y déficit.', kind: 'pattern' },
  protein: { id: 'training-protein', title: 'Entreno y proteína.', kind: 'pattern' },
  surplus: { id: 'weekend-surplus', title: 'Superávit.', kind: 'pattern' },
  constancy: { id: 'consistent-protein', title: 'Constancia.', kind: 'discovery' },
}

describe('pickFindingToAnnounce', () => {
  test('elige el de mayor prioridad (déficit antes que proteína)', () => {
    expect(pickFindingToAnnounce([P.protein, P.movement], {}, NOW)?.id).toBe('movement-deficit')
  })
  test('nunca avisa exceso ni constancias', () => {
    expect(pickFindingToAnnounce([P.surplus, P.constancy], {}, NOW)).toBeNull()
  })
  test('reposo de 14 días: avisado o visto hace 3 días no se repite', () => {
    const pick = pickFindingToAnnounce(
      [P.movement, P.protein],
      { 'movement-deficit': daysAgo(3) },
      NOW,
    )
    expect(pick?.id).toBe('training-protein')
  })
  test('pasados 14 días vuelve a ser elegible', () => {
    const pick = pickFindingToAnnounce([P.movement], { 'movement-deficit': daysAgo(15) }, NOW)
    expect(pick?.id).toBe('movement-deficit')
  })
  test('uno ya agendado a futuro se conserva aunque haya otro de más prioridad', () => {
    const pick = pickFindingToAnnounce(
      [P.movement, P.protein],
      { 'training-protein': inHours(20) },
      NOW,
    )
    expect(pick?.id).toBe('training-protein')
  })
  test('si el motor ya no ve el agendado, no se conserva', () => {
    expect(pickFindingToAnnounce([], { 'training-protein': inHours(20) }, NOW)).toBeNull()
  })
})

test('findingPushCopy: el hallazgo tal cual, con título fijo', () => {
  expect(findingPushCopy(P.movement)).toEqual({
    title: 'Nuevo patrón encontrado',
    body: 'Entreno y déficit.',
  })
})
