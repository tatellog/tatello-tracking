import Svg, { Circle, Ellipse, Path } from 'react-native-svg'

/** Los 4 momentos de comida (el mismo union que MealInput['meal_type']). */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/*
 * EL vocabulario celeste de los momentos de comida — UNA sola familia para
 * toda la app (auditoría visual 5 jul 2026: convivían dos vocabularios y la
 * usuaria veía el desayuno como sol pleno en Comidas y como amanecer en Hoy
 * el mismo día):
 *
 *   desayuno = sol · comida = planeta (anillo) · cena = luna · snack = cometa
 *
 * El cometa (no la ✦ de 4 puntas) evita la colisión simbólica con el FAB
 * Registrar. El anillo del planeta usa la prop `rotation` (no `transform`
 * en array: eso se rompe en el APK de Android, ver memoria del repo).
 * Consumers: MomentsToday (Comidas), TodayMealLog (Hoy), QuickLogSheet (✦).
 */
export function MealGlyph({
  type,
  size = 16,
  color,
}: {
  type: MealSlot
  size?: number
  color: string
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {type === 'breakfast' ? (
        <>
          <Circle cx={12} cy={12} r={4.2} fill={color} />
          <Path
            d="M12 2 V4.6 M12 19.4 V22 M2 12 H4.6 M19.4 12 H22 M5 5 L6.8 6.8 M17.2 17.2 L19 19 M17.2 6.8 L19 5 M5 19 L6.8 17.2"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      ) : type === 'lunch' ? (
        <>
          <Circle cx={12} cy={12} r={4.6} fill={color} />
          <Ellipse
            cx={12}
            cy={12}
            rx={9.2}
            ry={3}
            rotation={-22}
            originX={12}
            originY={12}
            stroke={color}
            strokeWidth={1.5}
            fill="none"
          />
        </>
      ) : type === 'dinner' ? (
        <Path d="M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z" fill={color} />
      ) : (
        <>
          <Circle cx={15.6} cy={8.4} r={3.6} fill={color} />
          <Path
            d="M12.4 11.6 L5 19 M14.8 13.6 L10 18.4 M10.6 9.2 L6.6 13.2"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  )
}
