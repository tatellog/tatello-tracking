# Paleta de colores y tipografía — Pearl Mauve

Sistema de diseño completo de la app. Cualquier color o tipografía que se use en código debe venir de aquí, vía tokens. Cero hex sueltos en componentes.

---

## Concepto

**Pearl Mauve** — femenino, limpio, fitness luxury. Pearl casi-blanco como base, casi-negro como texto, malva profundo como accent emocional. Inspirado en Glossier, Apple Fitness, Strava Pro. Editorial moderno, no bridal.

**Lo que NO es:** cream amarillo, cobre cálido, dorado, serif romántico. Eso era boda. Esta paleta es la opuesta.

---

## Paleta completa

### Backgrounds (familia Pearl)

| Token           | Hex       | Uso                                                                               |
| --------------- | --------- | --------------------------------------------------------------------------------- |
| `pearlBase`     | `#FAFAFB` | Fondo principal del screen. El "papel" sobre el que vive todo.                    |
| `pearlElevated` | `#FFFFFF` | Cards que flotan sobre pearlBase (card de racha, card de macros, action chips).   |
| `pearlMuted`    | `#F0EEF2` | Backgrounds chiquitos: ícono de modo día/noche, anillos de macros (stroke fondo). |

Los tres son casi blancos pero con undertones distintos. `pearlBase` tiene tinte violáceo muy ligero, `pearlElevated` es blanco puro, `pearlMuted` es violeta-gris suave.

### Text (familia Ink)

| Token        | Hex       | Uso                                                                                 |
| ------------ | --------- | ----------------------------------------------------------------------------------- |
| `inkPrimary` | `#1C1A1F` | Texto primario (números display, headers, body). Casi negro con undertone violáceo. |
| `inkSoft`    | `#3E3A42` | Texto secundario reservado (raramente usado, prefiere `labelMuted`).                |
| `labelMuted` | `#7A737E` | Labels UPPERCASE activos ("TU RACHA"), unidades ("/ 130 G").                        |
| `labelDim`   | `#B0A8B4` | Counters suaves, captions, tab inactive ("28 días", "Comidas").                     |

### Mauve (familia Accent)

| Token         | Hex                        | Uso                                                                                              |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `mauveLight`  | `#C9879E`                  | Inicio de gradients (siempre va de Light → Deep).                                                |
| `mauveDeep`   | `#A85E7C`                  | Accent principal: cuadro HOY, tile gigante, anillo de calorías, palabras resaltadas, tab active. |
| `mauveShadow` | `rgba(168, 94, 124, 0.25)` | Box-shadow de CTAs (loggear comida, tile gigante).                                               |

### Borders y dividers

| Token          | Hex       | Uso                                                                  |
| -------------- | --------- | -------------------------------------------------------------------- |
| `borderSubtle` | `#E8E3EB` | Bordes de cards, dividers horizontales sólidos.                      |
| `borderDashed` | `#D8D2DC` | Cells empty del grid (border dashed), divider vertical entre deltas. |

### Dark surfaces

| Token              | Hex       | Uso                                                                                               |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| `inkDark`          | `#1C1A1F` | Cells completed del grid (sólido, con opacity variable).                                          |
| `inkDarkHighlight` | `#2A252E` | Mid-point de gradients en surfaces oscuras (no se usa mucho ahora que eliminamos el SwipeToSeal). |

### Feedback (úsense con moderación)

| Token             | Hex       | Uso                                                                              |
| ----------------- | --------- | -------------------------------------------------------------------------------- |
| `feedbackSuccess` | `#5A6F4C` | Verde musgo. Confirmaciones sutiles (cuando se complete entreno: "✓ Entrenado"). |
| `feedbackError`   | `#B85045` | Rojo-terracota. Errores. NO usar rojo brillante — rompe la estética.             |

---

## Cómo se usa cada elemento de la pantalla

| Elemento de la UI                                           | Token de color                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fondo del screen                                            | `pearlBase`                                                                                                        |
| Card de racha                                               | `pearlElevated` con border `borderSubtle`                                                                          |
| Card de macros                                              | `pearlElevated` con border `borderSubtle`                                                                          |
| Cell del grid completada                                    | `inkPrimary` con opacity 0.3 (vieja), 0.6 (media), 1.0 (reciente)                                                  |
| Cell del grid vacía                                         | transparent + border 0.5px dashed `borderDashed`                                                                   |
| Tile gigante HOY (estado pendiente)                         | gradient `mauveLight` → `mauveDeep`, ring 2px `pearlElevated` + 1px `mauveDeep` exterior, halo animado `mauveDeep` |
| Cell HOY (estado completado)                                | igual que cells recent (`inkPrimary` opacity 1)                                                                    |
| Anillo proteína                                             | stroke `inkPrimary` sobre fondo `pearlMuted`                                                                       |
| Anillo calorías                                             | stroke `mauveDeep` sobre fondo `pearlMuted`                                                                        |
| Número en centro de anillo                                  | `inkPrimary`                                                                                                       |
| Sufijo "/ 130 G" en anillo                                  | `labelMuted`                                                                                                       |
| Botón "Loggear comida"                                      | gradient `mauveLight` → `mauveDeep`, texto `pearlBase`, shadow `mauveShadow`                                       |
| Texto principal (display, body)                             | `inkPrimary`                                                                                                       |
| Labels UPPERCASE activos ("TU RACHA", "ANCLA DE HOY")       | `labelMuted`                                                                                                       |
| Counters suaves ("28 días", "3 comidas")                    | `labelDim`                                                                                                         |
| Palabra resaltada en mensaje contextual ("45g de proteína") | `mauveDeep` con peso 600                                                                                           |
| Mini action chips ("📸 Progreso")                           | bg `pearlElevated`, border `borderSubtle`, texto `inkPrimary`                                                      |
| Mood orb (sin seleccionar)                                  | bg `pearlElevated`, border `borderSubtle`                                                                          |
| Mood orb (seleccionado)                                     | bg `pearlMuted`, border `mauveDeep`                                                                                |
| Tab bar fondo                                               | mismo `pearlBase` (no card separado)                                                                               |
| Tab activo                                                  | `mauveDeep` (ícono + label)                                                                                        |
| Tab inactivo                                                | `labelDim`                                                                                                         |
| Divider horizontal sólido                                   | `borderSubtle` con gradient fade en extremos                                                                       |
| Divider horizontal dashed (dentro de card)                  | dashed `borderSubtle`                                                                                              |
| Divider vertical (entre deltas, en card racha)              | gradient transparent → `borderDashed` → transparent                                                                |

---

## Tipografía

### Fuentes

Solo dos familias en todo el sistema:

- **Inter Tight** — para números display y elementos prominentes (la racha grande, deltas, números de macros, títulos del tile gigante)
- **Inter** — para labels, body, botones, todo lo que es UI funcional

NO usar serif. NO usar Cormorant, EB Garamond, Playfair, Georgia. La estética serif italic era el problema "boda".

### Pesos disponibles

```
Inter Tight: 300 (Light), 400 (Regular), 500 (Medium)
Inter: 400 (Regular), 500 (Medium), 600 (SemiBold)
```

### Cómo se aplica cada elemento

| Elemento                                       | Font        | Size   | Weight      | Letter-spacing |
| ---------------------------------------------- | ----------- | ------ | ----------- | -------------- |
| Número de racha "14"                           | Inter Tight | 48px   | 300 (light) | -2             |
| Número en anillos "85" / "1470"                | Inter Tight | 30px   | 400         | -1             |
| Deltas "−1.8" / "−2"                           | Inter Tight | 28px   | 400         | -1             |
| Title del tile gigante "＋"                    | Inter Tight | 28px   | 200         | 0              |
| Label UPPERCASE ("TU RACHA")                   | Inter       | 9px    | 600         | 2.4            |
| Label suave UPPERCASE ("28 días", "3 comidas") | Inter       | 9px    | 500         | 1.8            |
| Texto del tile "Marcar entreno"                | Inter       | 10.5px | 500         | 0.2            |
| Mensaje contextual macros (body)               | Inter       | 13px   | 400         | 0              |
| Palabras resaltadas en mensaje                 | Inter       | 13px   | 600         | 0              |
| Ancla del día "Entrena antes de las 6."        | Inter       | 17px   | 500         | 0              |
| Mini action chips                              | Inter       | 11.5px | 500         | 0              |
| Tab labels                                     | Inter       | 9.5px  | 500         | 0.3            |
| CTA "Loggear comida"                           | Inter       | 14px   | 500         | 0.3            |

### Instalación

```bash
pnpm add @expo-google-fonts/inter @expo-google-fonts/inter-tight
```

En `/app/_layout.tsx`:

```tsx
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter'
import {
  InterTight_300Light,
  InterTight_400Regular,
  InterTight_500Medium,
} from '@expo-google-fonts/inter-tight'

const [fontsLoaded] = useFonts({
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  InterTight_300Light,
  InterTight_400Regular,
  InterTight_500Medium,
})

if (!fontsLoaded) return null
```

---

## Archivo `/theme/colors.ts` (copia-pega)

```ts
export const colors = {
  // Backgrounds (pearl family)
  pearlBase: '#FAFAFB',
  pearlElevated: '#FFFFFF',
  pearlMuted: '#F0EEF2',

  // Text (ink family)
  inkPrimary: '#1C1A1F',
  inkSoft: '#3E3A42',
  labelMuted: '#7A737E',
  labelDim: '#B0A8B4',

  // Accent (mauve family)
  mauveLight: '#C9879E',
  mauveDeep: '#A85E7C',
  mauveShadow: 'rgba(168, 94, 124, 0.25)',

  // Borders / dividers
  borderSubtle: '#E8E3EB',
  borderDashed: '#D8D2DC',

  // Dark surfaces
  inkDark: '#1C1A1F',
  inkDarkHighlight: '#2A252E',

  // Shadows / overlays
  shadowCard: 'rgba(28, 26, 31, 0.08)',
  shadowLift: 'rgba(28, 26, 31, 0.15)',

  // Feedback colors
  feedbackSuccess: '#5A6F4C',
  feedbackError: '#B85045',
} as const

export type ColorToken = keyof typeof colors
```

---

## Archivo `/theme/typography.ts` (copia-pega)

```ts
export const typography = {
  // Display sans (números prominentes)
  display: 'InterTight_300Light',
  displayMedium: 'InterTight_400Regular',
  displaySemi: 'InterTight_500Medium',

  // UI sans (labels, body, botones)
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',

  sizes: {
    tinyLabel: 9,
    smallLabel: 10,
    caption: 11.5,
    body: 13,
    bodyLarge: 14,
    anchor: 17,
    deltaNum: 28,
    streakNum: 48,
    macroNum: 30,
    tilePlus: 28,
  },

  letterSpacing: {
    uppercaseWide: 2.4,
    uppercaseMed: 1.8,
    displayTight: -2,
    displayMed: -1,
    default: 0,
    bodyLoose: 0.3,
  },

  fontWeight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semi: '600' as const,
  },

  lineHeight: {
    displayTight: 0.95,
    body: 1.55,
    statement: 1.3,
  },
} as const
```

---

## Archivo `/theme/spacing.ts` (copia-pega)

```ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const

export const radius = {
  cell: 4, // celdas pequeñas del grid
  tile: 12, // tile gigante del HOY
  card: 22, // cards principales (racha, macros)
  screen: 38, // outer container del screen
  pill: 100, // botones pill (CTA, mini actions)
} as const

export const shadows = {
  card: {
    shadowColor: '#1C1A1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  ctaMauve: {
    shadowColor: '#A85E7C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  tileBig: {
    shadowColor: '#A85E7C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 5,
  },
  screenOuter: {
    shadowColor: '#1C1A1F',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.08,
    shadowRadius: 60,
    elevation: 6,
  },
} as const
```

---

## Reglas duras

1. **Cero hex sueltos en componentes.** Cualquier color va vía `colors.tokenName`. Si necesitas un color que no está, agrégalo al token file primero.

2. **Cero font families string sueltas.** Usa `typography.display` o `typography.ui`, nunca `'Inter'` directo.

3. **Cero serif fonts.** Si ves Cormorant, Georgia, EB Garamond, Playfair en código, está mal. Solo Inter / Inter Tight.

4. **Italic prohibido.** Lo que antes era italic prose es ahora UPPERCASE Inter Medium con letter-spacing wide. Es la diferencia clave entre estética boda vs fitness luxury.

5. **Gradients siempre Light → Deep en mauve.** `mauveLight` (#C9879E) arriba-izquierda, `mauveDeep` (#A85E7C) abajo-derecha. Dirección 135deg estándar.

6. **El verde feedbackSuccess solo para confirmaciones, no decoración.** No metas verde solo porque "se vería bonito". El producto es básicamente bicromático: ink + mauve sobre pearl.

---

## Self-check antes de declarar el design system implementado

- [ ] Screenshot del Home en simulator matchea visualmente el mockup que se mostró en el chat
- [ ] El número "14" se ve como Inter Tight light, no Cormorant ni Georgia
- [ ] Los labels "TU RACHA", "ANCLA DE HOY" están en uppercase Inter, no italic
- [ ] El cuadro HOY es malva (gradient C9879E → A85E7C), no cobre
- [ ] El fondo es pearl casi-blanco (#FAFAFB), no cream amarillo
- [ ] Los anillos de macros tienen proteína en negro, calorías en malva
- [ ] El CTA "Loggear comida" es malva sólido con gradient sutil
- [ ] Cero `#XXXXXX` directos en componentes (`grep -r "#" app features components | grep -v "//"`debe estar limpio excepto en theme/)
- [ ] Cero `fontFamily: 'Cormorant.*'` o `fontFamily: 'EB Garamond.*'` en el código
