import {
  bodyCompositionToRows,
  dayInTimezone,
  hkActivityToWorkoutType,
  normalizeWorkout,
  sleepSamplesToRows,
  stepsToRows,
} from '../logic'

const TZ = 'America/Mexico_City' // UTC-6 en estas fechas

describe('dayInTimezone — día LOCAL, nunca UTC', () => {
  it('un instante de madrugada UTC cae al día anterior en MX', () => {
    // 2026-07-08 03:00 UTC = 2026-07-07 21:00 MX
    expect(dayInTimezone(new Date('2026-07-08T03:00:00Z'), TZ)).toBe('2026-07-07')
  })
})

describe('hkActivityToWorkoutType — al vocabulario de los chips de Hoy', () => {
  it('mapea fuerza / cardio / caminata y lo desconocido cae a otro', () => {
    expect(hkActivityToWorkoutType(50)).toBe('fuerza') // traditionalStrength
    expect(hkActivityToWorkoutType(37)).toBe('cardio') // running
    expect(hkActivityToWorkoutType(52)).toBe('caminata') // walking
    expect(hkActivityToWorkoutType(57)).toBe('otro') // yoga
    expect(hkActivityToWorkoutType(9999)).toBe('otro')
  })
})

describe('normalizeWorkout', () => {
  const base = {
    uuid: 'hk-uuid-1',
    activityType: 50,
    start: new Date('2026-07-07T18:00:00Z'),
    end: new Date('2026-07-07T18:45:00Z'),
  }

  it('convierte segundos a minutos y redondea la kcal', () => {
    const row = normalizeWorkout({ ...base, durationSec: 2700, energyKcal: 342.4 }, 'apple_health')
    expect(row).toMatchObject({
      source: 'apple_health',
      external_id: 'hk-uuid-1',
      workout_type: 'fuerza',
      duration_min: 45,
      energy_kcal: 342,
    })
    expect(row.started_at).toBe('2026-07-07T18:00:00.000Z')
  })

  it('sin kcal → null (nunca 0 como deuda) y clampa basura a los CHECK', () => {
    expect(
      normalizeWorkout({ ...base, durationSec: null, energyKcal: null }, 'apple_health'),
    ).toMatchObject({ duration_min: null, energy_kcal: null })
    expect(
      normalizeWorkout({ ...base, durationSec: 999999, energyKcal: 99999 }, 'apple_health'),
    ).toMatchObject({ duration_min: 1440, energy_kcal: 5000 })
  })
})

describe('sleepSamplesToRows — el día en que despertó, solo etapas asleep', () => {
  // Noche MX: duerme 23:30 (=05:30Z del 8) → despierta 06:30 MX (=12:30Z del 8)
  const night = [
    // inBed NO cuenta (el error que infla 1-2h)
    {
      uuid: 'a',
      value: 0,
      start: new Date('2026-07-08T05:00:00Z'),
      end: new Date('2026-07-08T12:40:00Z'),
    },
    {
      uuid: 'b',
      value: 3,
      start: new Date('2026-07-08T05:30:00Z'),
      end: new Date('2026-07-08T09:00:00Z'),
    }, // core 3.5h
    {
      uuid: 'c',
      value: 2,
      start: new Date('2026-07-08T09:00:00Z'),
      end: new Date('2026-07-08T09:10:00Z'),
    }, // awake NO
    {
      uuid: 'd',
      value: 5,
      start: new Date('2026-07-08T09:10:00Z'),
      end: new Date('2026-07-08T12:30:00Z'),
    }, // REM 3h20
  ]

  it('agrupa por día local del fin, suma solo asleep, bedtime/wake reales', () => {
    const rows = sleepSamplesToRows(night, TZ, 'apple_health')
    expect(rows).toHaveLength(1)
    const r = rows[0]!
    expect(r.sleep_date).toBe('2026-07-08') // despertó 06:30 MX del día 8
    expect(r.asleep_minutes).toBe(210 + 200) // 3.5h + 3h20 = 410; awake/inBed fuera
    expect(r.external_id).toBe('sleep-2026-07-08')
    expect(r.bedtime_at).toBe('2026-07-08T05:30:00.000Z')
    expect(r.wake_at).toBe('2026-07-08T12:30:00.000Z')
  })

  it('dos noches → dos filas con ids estables (upsert idempotente)', () => {
    const twoNights = [
      ...night,
      {
        uuid: 'e',
        value: 1,
        start: new Date('2026-07-09T05:30:00Z'),
        end: new Date('2026-07-09T12:00:00Z'),
      },
    ]
    const rows = sleepSamplesToRows(twoNights, TZ, 'apple_health')
    expect(rows.map((r) => r.external_id)).toEqual(['sleep-2026-07-08', 'sleep-2026-07-09'])
  })
})

describe('stepsToRows', () => {
  it('bucket diario → fila por día local, clampa el techo', () => {
    const rows = stepsToRows(
      [
        { start: new Date('2026-07-07T06:00:00Z'), steps: 8432.7 },
        { start: new Date('2026-07-08T06:00:00Z'), steps: 999999 },
        { start: new Date('2026-07-09T06:00:00Z'), steps: 0 }, // se descarta
      ],
      TZ,
      'apple_health',
    )
    expect(rows).toEqual([
      { source: 'apple_health', day_date: '2026-07-07', steps: 8433 },
      { source: 'apple_health', day_date: '2026-07-08', steps: 200000 },
    ])
  })
})

describe('bodyCompositionToRows — snapshot diario de composición', () => {
  it('agrupa por día local y toma la muestra MÁS RECIENTE por métrica', () => {
    const rows = bodyCompositionToRows(
      [
        // 2026-07-07 (MX): dos lecturas de grasa, gana la más reciente.
        { metric: 'body_fat_pct', value: 25, date: new Date('2026-07-07T14:00:00Z') },
        { metric: 'body_fat_pct', value: 24.2, date: new Date('2026-07-07T22:00:00Z') },
        { metric: 'lean_body_mass_kg', value: 48.6, date: new Date('2026-07-07T14:00:00Z') },
        { metric: 'bmi', value: 23.4, date: new Date('2026-07-07T14:00:00Z') },
      ],
      TZ,
      'apple_health',
    )
    expect(rows).toEqual([
      {
        source: 'apple_health',
        day_date: '2026-07-07',
        body_fat_pct: 24.2,
        lean_body_mass_kg: 48.6,
        bmi: 23.4,
      },
    ])
  })

  it('descarta valores <= 0 y días sin ninguna métrica', () => {
    const rows = bodyCompositionToRows(
      [{ metric: 'body_fat_pct', value: 0, date: new Date('2026-07-07T14:00:00Z') }],
      TZ,
      'apple_health',
    )
    expect(rows).toEqual([])
  })

  it('clampa fuera de rango y redondea a 1 decimal', () => {
    const rows = bodyCompositionToRows(
      [
        { metric: 'body_fat_pct', value: 150, date: new Date('2026-07-07T14:00:00Z') },
        { metric: 'lean_body_mass_kg', value: 45.678, date: new Date('2026-07-07T14:00:00Z') },
      ],
      TZ,
      'apple_health',
    )
    expect(rows[0]!.body_fat_pct).toBe(100)
    expect(rows[0]!.lean_body_mass_kg).toBe(45.7)
  })

  it('una fila por día, ordenadas cronológicamente', () => {
    const rows = bodyCompositionToRows(
      [
        { metric: 'bmi', value: 23, date: new Date('2026-07-09T14:00:00Z') },
        { metric: 'bmi', value: 22, date: new Date('2026-07-07T14:00:00Z') },
      ],
      TZ,
      'apple_health',
    )
    expect(rows.map((r) => r.day_date)).toEqual(['2026-07-07', '2026-07-09'])
  })
})
