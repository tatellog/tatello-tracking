const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
}
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  // El motor compartido (supabase/functions/_shared/intelligence) usa imports
  // relativos CON extensión `.ts` para que el runtime Deno 2 del edge los
  // resuelva (sloppy-imports dejó de funcionar en boot). Metro no resuelve el
  // `.ts` explícito, así que aquí lo quitamos y delegamos al resolver por
  // defecto. Solo afecta a specifiers relativos que terminan en .ts/.tsx.
  resolveRequest: (context, moduleName, platform) => {
    const stripped = /^\.\.?\/.*\.tsx?$/.test(moduleName)
      ? moduleName.replace(/\.tsx?$/, '')
      : moduleName
    const resolve = defaultResolveRequest ?? context.resolveRequest
    return resolve(context, stripped, platform)
  },
}

module.exports = withNativeWind(config, { input: './global.css' })
