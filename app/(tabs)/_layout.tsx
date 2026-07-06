import { Tabs } from 'expo-router'
import { type ComponentType } from 'react'
import { View } from 'react-native'
import { type SvgProps } from 'react-native-svg'

import FoodVect from '@/assets/icons/food-vect.svg'
import Orbits from '@/assets/icons/orbits.svg'
import Progress from '@/assets/icons/progress.svg'
import Sunset from '@/assets/icons/sunset.svg'
import { BetaFeedbackButton } from '@/components/BetaFeedbackButton'
import { ScanFeedbackToast } from '@/features/meal-scan/components/ScanFeedbackToast'
import { useDayCloseInvite, useNextStarInvite } from '@/features/notifications/hooks'
import {
  AppTabBar,
  CelebrationOverlay,
  UndoMealToast,
  UniverseDeltaToast,
} from '@/features/tabs/components'
import { colors } from '@/theme'

/* Tab glyphs. Custom vector illustrations from `assets/icons/`:
 *   • sunset       → Hoy
 *   • food-vect    → Comidas
 *   • progress     → Progreso
 *   • orbits       → Órbita
 *
 * Each SVG was authored with `fill="currentColor"` so the `color` prop
 * tints every stroke to leche. Shared focused-state treatment:
 *   • inactive  → opacity 0.45 + no scale     (recedes)
 *   • active    → opacity 1.0  + scale 1.08   (pops)
 *
 * Earlier iterations used `@expo/vector-icons` (Feather sun/activity,
 * Ionicons planet-outline, MaterialIcons dinner-dining); replaced with
 * the in-house glyphs so the tab bar reads as one family with the rest
 * of Stelar's visual system. */
/* `strokeWidth` is in viewBox units, not screen px — the source SVGs have
 * viewBoxes ~800–1220 wide. A value of ~18 there reads as a noticeable
 * outline around each `currentColor` fill at 32px screen size, which is
 * what gives the glyphs their extra weight (the source paths are too
 * delicate to read as "tab icons" at native scale).  */
function SvgTabIcon({
  Icon,
  size = 38,
  focused = false,
}: {
  Icon: ComponentType<SvgProps>
  size?: number
  focused?: boolean
}) {
  return (
    <View
      style={{
        opacity: focused ? 1 : 0.45,
        transform: [{ scale: focused ? 1.08 : 1 }],
      }}
    >
      <Icon
        width={size}
        height={size}
        color={colors.leche}
        stroke={colors.leche}
        strokeWidth={18}
        strokeLinejoin="round"
        preserveAspectRatio="xMidYMid meet"
      />
    </View>
  )
}

// The bottom chrome is a custom component (AppTabBar): a navigation
// pill plus a detached magenta ✦ that opens the quick-log. Screen
// options here only carry each tab's title + icon — AppTabBar reads
// them off the route descriptors. Ajustes is the exception: it has no
// icon here because it's not in the pill — it's the header gear, and
// AppTabBar skips its route.
export default function TabsLayout() {
  // La invitación del día siguiente (Mecánica D): cada sesión re-agenda la
  // invitación de mañana + la red de 7 días en la ventana elegida —
  // auto-capadas, ver features/notifications/invite.ts.
  useNextStarInvite()
  // La cita del cierre: primera comida del día → push 20:15 "tu cierre
  // está listo". Solo días con comida; jamás reproche.
  useDayCloseInvite()
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <AppTabBar {...props} />}
        // Keep inactive tab screens ATTACHED to the native view hierarchy.
        // By default react-native-screens detaches a blurred tab's native
        // screen and re-attaches it on return — for the heavy Skia tabs
        // (Órbita, Hoy) that re-attach repaints the canvases from scratch and
        // flashed BLACK on every tab switch. Staying attached keeps them
        // painted → instant, no black. (Costs some memory holding all screens.)
        detachInactiveScreens={false}
        screenOptions={{
          headerShown: false,
          // Dark scene container so no white shows before a tab's content
          // paints (the root nav theme is dark too — belt + suspenders).
          sceneStyle: { backgroundColor: colors.bg },
          // freezeOnBlur OFF: it suspended off-tab renders, but on return it had
          // to THAW + repaint the whole heavy screen (Skia + constellation),
          // which lingered BLANK for long enough to screenshot. Staying rendered
          // means the screen is already painted on return → no thaw blank. The
          // off-tab cost is low: the animation loops are gated separately on
          // `useScreenActive()`/focus (they don't run off-tab regardless), so
          // the only extra work is React reconciliation on a rare data change.
          freezeOnBlur: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Hoy',
            tabBarIcon: ({ focused }) => <SvgTabIcon Icon={Sunset} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="meals"
          options={{
            title: 'Comidas',
            tabBarIcon: ({ focused }) => <SvgTabIcon Icon={FoodVect} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progreso',
            tabBarIcon: ({ focused }) => <SvgTabIcon Icon={Progress} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="orbit"
          options={{
            title: 'Órbita',
            tabBarIcon: ({ focused }) => <SvgTabIcon Icon={Orbits} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Ajustes',
          }}
        />
        {/* "Tu constancia" (calendario de movimiento) — pantalla del navegador de
            tabs pero OCULTA del pill (href: null + AppTabBar la salta). Vive aquí
            para conservar la barra de tabs y el header; se abre desde el ícono de
            calendario del header. */}
        <Tabs.Screen name="movement-calendar" options={{ href: null, title: 'Tu constancia' }} />
      </Tabs>
      {/* Celebración full-screen ("Entrené") — DESPUÉS de <Tabs> para que el
          flash dorado cubra toda la pantalla, incluyendo la barra de tabs. */}
      <CelebrationOverlay />
      <BetaFeedbackButton />
      <UniverseDeltaToast />
      {/* Deshacer del re-log de 1 tap — global: sobrevive al cierre del sheet. */}
      <UndoMealToast />
      {/* "¿Le atiné?" del scan (M1) — global: recibe a la usuaria al volver. */}
      <ScanFeedbackToast />
      {/* La ceremonia de revelación (RevealReplayHost) subió a la RAÍZ
          (app/_layout), encima del Stack, para cubrir también rutas modales
          como movement-calendar (antes, aquí en (tabs), quedaba debajo). */}
    </View>
  )
}
