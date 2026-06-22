// Test-runtime shims for native modules that can't boot inside the
// Node/jsdom runtime used by jest. Only mock what's actually reached
// from test code paths — pure-logic tests under features/..__tests__
// don't need any of this, but keeping the shim here means component
// tests can be written later without reconfiguring the setup.

// Reanimated ships its own jest helper that installs worklet stubs.
import 'react-native-reanimated/mock'

// Componentes que usan `useIsFocused()` (constelación, emblema) se renderizan
// en tests sin un NavigationContainer. Solo sobreescribimos ese hook (el resto
// de @react-navigation queda real) para que rendericen como "en foco".
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}))
