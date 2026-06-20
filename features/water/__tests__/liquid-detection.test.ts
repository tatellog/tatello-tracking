import { detectLiquids, liquidFactor } from '../liquid-detection'

/*
 * Detector determinístico de líquidos → hidratación. Runner: jest.
 * Un vaso = 250 ml; el factor escala el aporte y se redondea a 0.25.
 */

describe('detectLiquids · factores por tipo', () => {
  it('agua cuenta al 100 % (1 ración = 1 vaso)', () => {
    const { items, totalGlasses } = detectLiquids({ name: 'Vaso de agua' })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ factor: 1, glasses: 1, confidence: 'high' })
    expect(totalGlasses).toBe(1)
  })

  it('agua mineral y agua con limón cuentan al 100 %', () => {
    expect(detectLiquids({ name: 'Agua mineral' }).items[0]?.factor).toBe(1)
    expect(detectLiquids({ name: 'Agua con limón' }).items[0]?.factor).toBe(1)
  })

  it('té e infusiones cuentan al 100 %', () => {
    expect(detectLiquids({ name: 'Té verde' }).items[0]?.factor).toBe(1)
    expect(detectLiquids({ name: 'Una infusión de manzanilla' }).items[0]?.factor).toBe(1)
  })

  it('jugo verde y agua fresca cuentan al 75 %', () => {
    const jugo = detectLiquids({ name: 'Jugo verde' })
    expect(jugo.items[0]).toMatchObject({ factor: 0.75, glasses: 0.75, confidence: 'high' })
    expect(detectLiquids({ name: 'Agua fresca de pepino' }).items[0]?.factor).toBe(0.75)
    expect(detectLiquids({ name: 'Electrolitos' }).items[0]?.factor).toBe(0.75)
  })

  it('licuado, café, leche, caldo y sopa cuentan al 50 % (confianza baja)', () => {
    for (const name of [
      'Licuado de plátano',
      'Café americano',
      'Leche',
      'Caldo de pollo',
      'Sopa',
    ]) {
      const { items } = detectLiquids({ name })
      expect(items[0]).toMatchObject({ factor: 0.5, glasses: 0.5, confidence: 'low' })
    }
  })
})

describe('detectLiquids · exclusiones (0 %)', () => {
  it('alcohol, refresco, malteada y bebidas azucaradas no aportan', () => {
    for (const name of ['Cerveza', 'Refresco de cola', 'Coca cola', 'Malteada', 'Agua azucarada']) {
      expect(detectLiquids({ name }).items).toHaveLength(0)
    }
  })

  it('refresco zero/light/sin azúcar cuenta 50%, el normal sigue 0%', () => {
    for (const name of ['Coca Zero', 'Coca cola light', 'Refresco sin azúcar', 'Pepsi light']) {
      const { items } = detectLiquids({ name })
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ factor: 0.5, confidence: 'low' })
    }
    expect(detectLiquids({ name: 'Coca cola' }).items).toHaveLength(0)
    expect(detectLiquids({ name: 'Refresco de naranja' }).items).toHaveLength(0)
  })

  it('"té sin azúcar" NO se veta por la palabra azúcar', () => {
    const { items } = detectLiquids({ name: 'Té sin azúcar' })
    expect(items).toHaveLength(1)
    expect(items[0]?.factor).toBe(1)
  })

  it('un líquido vetado dentro de un ingrediente no aporta', () => {
    const { items } = detectLiquids({
      name: 'Comida',
      ingredients: [{ name: 'refresco', grams: 355 }],
    })
    expect(items).toHaveLength(0)
  })
})

describe('detectLiquids · no-líquidos', () => {
  it('comida sólida no detecta nada', () => {
    const { items, totalGlasses, confidence } = detectLiquids({
      name: 'Pechuga con arroz',
      ingredients: [
        { name: 'pechuga de pollo', grams: 150 },
        { name: 'arroz', grams: 100 },
      ],
    })
    expect(items).toHaveLength(0)
    expect(totalGlasses).toBe(0)
    expect(confidence).toBe('high')
  })

  it('"filete" no matchea "té" (boundary de palabra)', () => {
    expect(detectLiquids({ name: 'Filete de res' }).items).toHaveLength(0)
  })

  it('jugo de naranja cuenta al 50% (jugo de fruta), jugo verde sigue 75%', () => {
    const naranja = detectLiquids({ name: 'Jugo de naranja' })
    expect(naranja.items).toHaveLength(1)
    expect(naranja.items[0]).toMatchObject({ factor: 0.5, confidence: 'low' })
    // El más específico gana: "jugo verde" no baja a 50% por contener "jugo".
    expect(detectLiquids({ name: 'Jugo verde' }).items[0]?.factor).toBe(0.75)
  })
})

describe('detectLiquids · estimación por gramos', () => {
  it('usa gramos/250 cuando el ingrediente los trae', () => {
    // 500 g de agua = 2 vasos × factor 1 = 2.
    const { items } = detectLiquids({ name: 'Comida', ingredients: [{ name: 'agua', grams: 500 }] })
    expect(items[0]?.glasses).toBe(2)
  })

  it('redondea el aporte a múltiplos de 0.25', () => {
    // 300 g de leche = 1.2 vasos × 0.5 = 0.6 → 0.5.
    const { items } = detectLiquids({
      name: 'Comida',
      ingredients: [{ name: 'leche', grams: 300 }],
    })
    expect(items[0]?.glasses).toBe(0.5)
  })

  it('respeta el tope de 8 vasos por comida', () => {
    const { items, totalGlasses } = detectLiquids({
      name: 'Comida',
      ingredients: [{ name: 'agua', grams: 5000 }],
    })
    expect(items[0]?.glasses).toBeLessThanOrEqual(8)
    expect(totalGlasses).toBeLessThanOrEqual(8)
  })
})

describe('liquidFactor · clasificación por nombre (gate de "agua pura")', () => {
  it('agua/té/infusión por nombre = 100% (candidatos a agua pura)', () => {
    expect(liquidFactor('Agua')).toBe(1)
    expect(liquidFactor('Agua mineral')).toBe(1)
    expect(liquidFactor('Té verde')).toBe(1)
    expect(liquidFactor('Agua con limón')).toBe(1)
  })

  it('caldo / sopa / jugo NO son 100% → son comida que además hidrata', () => {
    // El bug reportado: "caldo de pollo" no debe tratarse como agua pura.
    expect(liquidFactor('Caldo de pollo')).toBe(0.5)
    expect(liquidFactor('Sopa de verduras')).toBe(0.5)
    expect(liquidFactor('Jugo de naranja')).toBe(0.5)
    expect(liquidFactor('Licuado de plátano')).toBe(0.5)
  })

  it('comida sólida no es líquido', () => {
    expect(liquidFactor('Pechuga con arroz')).toBeNull()
  })
})

describe('detectLiquids · combinación y dedup', () => {
  it('suma líquidos distintos (agua + leche)', () => {
    const { items, totalGlasses } = detectLiquids({
      name: 'Desayuno',
      ingredients: [
        { name: 'agua', grams: 250 },
        { name: 'leche', grams: 250 },
      ],
    })
    expect(items).toHaveLength(2)
    // agua 1 + leche 0.5 = 1.5
    expect(totalGlasses).toBe(1.5)
  })

  it('no cuenta el mismo líquido dos veces (nombre + ingrediente)', () => {
    const { items } = detectLiquids({
      name: 'Jugo verde',
      ingredients: [{ name: 'jugo verde', grams: 250 }],
    })
    expect(items).toHaveLength(1)
  })

  it('confidence global es low solo si TODO es ambiguo', () => {
    expect(detectLiquids({ name: 'Licuado' }).confidence).toBe('low')
    expect(
      detectLiquids({
        name: 'Combo',
        ingredients: [
          { name: 'agua', grams: 250 },
          { name: 'leche', grams: 250 },
        ],
      }).confidence,
    ).toBe('high')
  })
})
