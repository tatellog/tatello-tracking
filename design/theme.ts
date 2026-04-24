import AsyncStorage from '@react-native-async-storage/async-storage'
import { colorScheme } from 'nativewind'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/*
 * Theme preference store.
 *
 * Three states:
 *   - 'light'   — user locked to light regardless of OS
 *   - 'dark'    — user locked to dark regardless of OS
 *   - 'system'  — follow the OS colour scheme
 *
 * Persisted to AsyncStorage so the preference survives reloads. The store
 * syncs with NativeWind's `colorScheme` module — calling `setPreference`
 * flips the `.dark` class on the component tree, which cascades through
 * every semantic CSS token defined in `global.css`.
 *
 * Hydration (restoring the persisted value at boot) is handled in the
 * root layout so the app doesn't flash light-on-boot for users on dark.
 */

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeStore = {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => {
        colorScheme.set(preference)
        set({ preference })
      },
    }),
    {
      name: 'tracking-app.theme',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) colorScheme.set(state.preference)
      },
    },
  ),
)
