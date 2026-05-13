const expoConfig = require('eslint-config-expo/flat')
const eslintConfigPrettier = require('eslint-config-prettier')

module.exports = [
  ...expoConfig,
  eslintConfigPrettier,
  {
    ignores: [
      'node_modules',
      '.expo',
      'dist',
      'web-build',
      'ios',
      'android',
      // Design hand-off prototypes — HTML + React/Babel inline, not
      // part of the app. Kept in-repo as the visual source of truth
      // for the Norte onboarding redesign.
      'design_handoff_norte_onboarding',
    ],
  },
]
