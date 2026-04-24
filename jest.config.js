/*
 * Test harness — jest-expo handles the React Native transform chain
 * (Babel → Metro equivalents) so both .ts/.tsx/.js run. Native-only
 * modules that don't have jest setup (reanimated, gesture-handler,
 * haptics, secure-store, svg) are mocked at setup time in
 * jest.setup.ts so pure-logic tests don't need to pretend to be a
 * device.
 *
 * `testMatch` keeps tests colocated with features under
 * `__tests__/*.test.ts(x)` — standard convention, scales cleanly.
 */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack|nativewind|react-native-css-interop|react-native-reanimated|react-native-gesture-handler))',
  ],
}
