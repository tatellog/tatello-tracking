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
  // ── Guardrail del sistema visual (C3 · plan Parte 3, modelo Apple) ──
  // La consistencia no se vigila, se hace API: hex y fontSize numéricos
  // fuera de theme/ son WARN (suben a error por carpeta cuando su
  // superficie migre, C2). Los tokens viven en theme/; las ESCENAS DE
  // ARTE (el hex es pintura) están exentas abajo — la lista canónica es
  // docs/design-tokens-inventory.md.
  {
    files: ['app/**/*.{ts,tsx}', 'features/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message:
            'Hex fuera de theme/: usa un token de colors.* (o, si es pintura de escena, agrega el archivo a los exentos del eslint.config + inventario).',
        },
        {
          selector: "Property[key.name='fontSize'] > Literal[raw=/^[0-9.]+$/]",
          message: 'fontSize numérico: usa typography.sizes.* o un rol de theme/text-styles.ts.',
        },
      ],
    },
  },
  // Exentos: escenas de arte (atmósferas, constelación, Skia, share cards)
  // + theme/ mismo. Espejo de la cubeta (c) del inventario C0.
  {
    files: [
      'theme/**',
      'app/onboarding/**',
      'features/tabs/components/constellation/**',
      'features/**/*Sky*.{ts,tsx}',
      'features/orbit/components/Cosmos.tsx',
      'features/orbit/components/OrbitalSystem.tsx',
      'features/orbit/components/WeekConstellation.tsx',
      'features/orbit/components/week-dim-visual.ts',
      'features/orbit/components/stairs/**',
      'features/orbit/components/log/**',
      'features/progress/components/MovementConstellation.tsx',
      'features/progress/share-styles.ts',
      'features/progress/components/*Share*.{ts,tsx}',
      'features/progress/components/DaySheetAtmosphere.tsx',
      'features/patterns/components/PatternReveal.tsx',
      'features/orbit/components/PatternConstellation.tsx',
      'features/emblem/components/**',
      'features/revelations/components/**',
      'features/home/components/celebrate-shockwave/**',
      'components/StarLoader.tsx',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]
