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
      // Supabase edge functions run on Deno (URL imports, global Deno),
      // not on the app's Node/Metro toolchain. The app's eslint resolver
      // can't resolve `https://esm.sh/...` imports; Deno typechecks them
      // via supabase/functions/*/deno.json on deploy.
      'supabase/functions',
      // Design hand-off prototypes — HTML + React/Babel inline, not
      // part of the app. Kept in-repo as the visual source of truth
      // for the Norte onboarding redesign.
      'design_handoff_norte_onboarding',
    ],
  },
]
