/*
 * Dev-only sample meal photos — bundled so the meal circles on "Hoy"
 * can be previewed with real food before scanned photos fill them in.
 *
 * To enable: drop meal-1.jpg / meal-2.jpg / meal-3.jpg into
 * assets/sample-meals/ (see the README there), then uncomment the
 * three require() lines below.
 *
 * Bundled only in development; production uses the real photos the
 * scan-meal flow uploads to the `meal-photos` bucket.
 */
import type { ImageSourcePropType } from 'react-native'

export const SAMPLE_MEAL_PHOTOS: ImageSourcePropType[] = [
  // require('../../assets/sample-meals/meal-1.jpg'),
  // require('../../assets/sample-meals/meal-2.jpg'),
  // require('../../assets/sample-meals/meal-3.jpg'),
]
