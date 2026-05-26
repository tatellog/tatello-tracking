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
  /** Optional astronomical name (e.g. "Regulus"). Used by daily
   *  coach copy to name the star that lit today. */
  name?: string
  /** Optional anatomical role on the figure (e.g. "el corazón
   *  del león"). Pairs with `name` in the day-specific subtitle. */
  role?: string
}

export type ZodiacDef = {
  /** Uppercase Spanish label rendered on the zodiac cap. */
  label: string
  glyph: string
  stars: readonly ZodiacStar[]
  lines: readonly (readonly [number, number])[]
}
