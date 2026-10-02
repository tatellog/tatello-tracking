import { Platform } from 'react-native'

/*
 * Movimiento AMBIENTAL (el cielo que titila, los brillos que respiran en
 * anillos y botones). En Android cada uno de estos bucles infinitos le cuesta
 * al hilo de UI mucho más que en iOS, y Hoy tiene varios a la vez (dueña 1 oct
 * 2026: "el tab Hoy en Android está lento"). En Android quedan QUIETOS en su
 * punto de reposo; las animaciones con sentido (dibujar un anillo al entrar,
 * la celebración, encender una estrella) siguen igual.
 */
export const AMBIENT_MOTION = Platform.OS !== 'android'
