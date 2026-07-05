import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { dayCloseCopy, dayCloseVerdict } from '../day-close'

/*
 * "El cierre de hoy" — la card del veredicto nocturno en Hoy. Desde las
 * 20:00, con ≥1 comida registrada, responde claro y sin poesía si el día
 * quedó en déficit — y lo conecta con el calendario dorado de Órbita Mes
 * (misma definición de déficit sano). Lógica pura en ../day-close.ts.
 *
 * El ticker de hora vive AQUÍ (no en Hoy) para que el paso de 19:59 →
 * 20:00 re-renderice solo esta card, nunca el árbol pesado de la
 * constelación. "No déficit" jamás usa rojo: la brasa es neutra.
 */

export function DayCloseCard({
  consumedCalories,
  targetCalories,
  mealCount,
  reading,
}: {
  consumedCalories: number
  targetCalories: number | null | undefined
  mealCount: number
  /** Micro-observación real del motor (early-readings): la recompensa
   *  VARIABLE del cierre — cada noche puede decir algo distinto de ELLA,
   *  el puente de las semanas 1-3 antes de los patrones. Null = se omite
   *  (jamás relleno). */
  reading?: string | null
}) {
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  const verdict = dayCloseVerdict({ consumedCalories, targetCalories, mealCount, hour })
  if (!verdict) return null
  const copy = dayCloseCopy(verdict)
  const gold = verdict.kind === 'deficit'

  return (
    <Animated.View
      entering={FadeIn.duration(420)}
      style={[styles.card, gold && styles.cardGold]}
      accessible
      accessibilityLabel={`El cierre de hoy. ${copy.data} ${copy.coach}`}
    >
      <View style={styles.headRow}>
        {/* La marca del veredicto: estrella oro si el día quedó dorado,
            brasa neutra si no (mismo lenguaje que el calendario del mes). */}
        {gold ? (
          <View style={styles.starGlow}>
            <View style={styles.starBody} />
          </View>
        ) : (
          <View style={styles.ember} />
        )}
        <EyebrowLabel tone={gold ? 'bone' : 'niebla'} size={10}>
          El cierre de hoy
        </EyebrowLabel>
      </View>
      <Text style={styles.data}>{copy.data}</Text>
      <Text style={[styles.coach, gold && styles.coachGold]}>{copy.coach}</Text>
      {reading ? <Text style={styles.reading}>{reading}</Text> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardGold: {
    borderColor: colors.oroHairline,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  // Estrella dorada (día en déficit) — miniatura del tratamiento del
  // calendario de Órbita Mes: el único estado que emite luz.
  starGlow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroGlow,
  },
  starBody: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.oroLight,
  },
  // Brasa neutra (superávit / muy bajo) — descansa, no alarma.
  ember: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.bone,
    opacity: 0.55,
  },
  // Los números primero, literales (la usuaria pidió "claro y sin poesía").
  data: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  coach: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  coachGold: {
    color: colors.oroLight,
  },
  // La micro-observación — dato en UI upright (no voz de coach), separada
  // del veredicto por un respiro; discreta, nunca compite con el número.
  reading: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})
