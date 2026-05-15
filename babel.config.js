module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // react-native-worklets/plugin must be last; it walks the AST
    // looking for 'worklet' directives, and earlier plugins can
    // rewrite code in ways that hide them. (Reanimated 4 delegates
    // worklet compilation to this separate package.)
    plugins: ['react-native-worklets/plugin'],
  }
}
