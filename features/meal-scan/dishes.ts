/*
 * Dummy dish library — stands in for an AI vision model. `scanMeal`
 * returns one of these as the "detected" meal. Nutrition is stored
 * per 100 g so editing an ingredient's grams rescales it.
 */
export type DishIngredient = {
  name: string
  /** Detected (default) amount, grams. */
  grams: number
  proteinPer100: number
  kcalPer100: number
}

export type Dish = {
  name: string
  ingredients: DishIngredient[]
}

export const DISHES: Dish[] = [
  {
    name: 'Salmón con burrata y tomate',
    ingredients: [
      { name: 'Salmón cocido', grams: 150, proteinPer100: 25, kcalPer100: 206 },
      { name: 'Tomate cherry', grams: 80, proteinPer100: 0.9, kcalPer100: 18 },
      { name: 'Burrata', grams: 100, proteinPer100: 17, kcalPer100: 290 },
    ],
  },
  {
    name: 'Pollo con arroz y brócoli',
    ingredients: [
      { name: 'Pechuga de pollo', grams: 150, proteinPer100: 31, kcalPer100: 165 },
      { name: 'Arroz cocido', grams: 180, proteinPer100: 2.7, kcalPer100: 130 },
      { name: 'Brócoli', grams: 90, proteinPer100: 2.8, kcalPer100: 35 },
    ],
  },
  {
    name: 'Bowl de avena con plátano',
    ingredients: [
      { name: 'Avena cocida', grams: 220, proteinPer100: 2.4, kcalPer100: 71 },
      { name: 'Plátano', grams: 100, proteinPer100: 1.1, kcalPer100: 89 },
      { name: 'Mantequilla de maní', grams: 20, proteinPer100: 25, kcalPer100: 588 },
    ],
  },
  {
    name: 'Huevos con aguacate',
    ingredients: [
      { name: 'Huevo', grams: 120, proteinPer100: 13, kcalPer100: 155 },
      { name: 'Aguacate', grams: 70, proteinPer100: 2, kcalPer100: 160 },
      { name: 'Pan integral', grams: 60, proteinPer100: 9, kcalPer100: 247 },
    ],
  },
  {
    name: 'Ensalada César con pollo',
    ingredients: [
      { name: 'Lechuga romana', grams: 80, proteinPer100: 1.2, kcalPer100: 17 },
      { name: 'Pechuga de pollo', grams: 120, proteinPer100: 31, kcalPer100: 165 },
      { name: 'Aderezo César', grams: 30, proteinPer100: 1.5, kcalPer100: 430 },
      { name: 'Queso parmesano', grams: 20, proteinPer100: 35, kcalPer100: 392 },
    ],
  },
  {
    name: 'Tacos de carne asada',
    ingredients: [
      { name: 'Tortilla de maíz', grams: 90, proteinPer100: 5.7, kcalPer100: 218 },
      { name: 'Carne asada', grams: 130, proteinPer100: 27, kcalPer100: 250 },
      { name: 'Cebolla y cilantro', grams: 30, proteinPer100: 1.1, kcalPer100: 40 },
    ],
  },
  {
    name: 'Yogurt griego con granola',
    ingredients: [
      { name: 'Yogurt griego', grams: 200, proteinPer100: 10, kcalPer100: 59 },
      { name: 'Granola', grams: 45, proteinPer100: 10, kcalPer100: 470 },
      { name: 'Miel', grams: 15, proteinPer100: 0.3, kcalPer100: 304 },
    ],
  },
]
