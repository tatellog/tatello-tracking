export type ZodiacSign =
  | 'aries'
  | 'tauro'
  | 'geminis'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'escorpio'
  | 'sagitario'
  | 'capricornio'
  | 'acuario'
  | 'piscis'

export type ZodiacStar = {
  /** Relative coord 0..1 inside the SVG box. */
  x: number
  y: number
  /** 1 = brightest (largest dot), 5 = faintest. */
  mag: number
}

export type ZodiacDef = {
  /** Uppercase Spanish label rendered on the zodiac cap. */
  label: string
  glyph: string
  stars: readonly ZodiacStar[]
  lines: readonly (readonly [number, number])[]
}
