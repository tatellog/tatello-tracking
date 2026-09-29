/*
 * HealthKit background delivery · registro de observers al arrancar.
 *
 * Apple exige que los HKObserverQuery se registren en
 * didFinishLaunchingWithOptions para que iOS despierte la app (cerrada) cuando
 * Salud recibe datos nuevos (el sueño de anoche que Garmin Connect escribe).
 * @kingstinct/react-native-healthkit 14.0.2 trae BackgroundDeliveryManager pero
 * su app.plugin.js publicado NO inserta la llamada en el AppDelegate (el .ts
 * del paquete sí, pero su regex no casa con el AppDelegate multilínea de Expo 54
 * e importa el módulo, lo que no compila). Este plugin lo hace. Los tipos a observar los persiste la app con
 * configureBackgroundTypes (features/wearables/healthkit.ts).
 */
const { withAppDelegate, createRunOncePlugin } = require('@expo/config-plugins')

// Sin `import ReactNativeHealthkit`: el módulo Swift de la lib (Nitro) usa
// interop con C++ y el AppDelegate no; importarlo rompe la compilación. Se
// llama por el runtime de Objective-C (@objc public class): si la clase no
// existe, no hace nada.
const MARKER = 'BackgroundDeliveryManager'
const SETUP_CALL = [
  '    // HealthKit background delivery (plugins/with-healthkit-background-observers.js).',
  '    // Todo con guardas: si la clase o el método no existen, no hace nada.',
  '    if let managerClass = NSClassFromString("ReactNativeHealthkit.BackgroundDeliveryManager") {',
  '      let manager = managerClass as AnyObject',
  '      let sharedSel = NSSelectorFromString("shared")',
  '      let setupSel = NSSelectorFromString("setupBackgroundObservers")',
  '      if manager.responds(to: sharedSel),',
  '         let shared = manager.value(forKey: "shared") as? NSObject,',
  '         shared.responds(to: setupSel) {',
  '        _ = shared.perform(setupSel)',
  '      }',
  '    }',
].join('\n')

function withHealthkitBackgroundObservers(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('with-healthkit-background-observers: solo soporta AppDelegate en Swift')
    }
    let src = cfg.modResults.contents
    if (!src.includes(MARKER)) {
      // Justo después de la llave que abre didFinishLaunchingWithOptions
      // (firma multilínea en Expo 54: "...launchOptions: ...\n  ) -> Bool {").
      const re = /(didFinishLaunchingWithOptions[\s\S]*?-> Bool \{\n)/
      if (!re.test(src)) {
        throw new Error(
          'with-healthkit-background-observers: no encontré didFinishLaunchingWithOptions',
        )
      }
      src = src.replace(re, `$1${SETUP_CALL}\n`)
    }
    cfg.modResults.contents = src
    return cfg
  })
}

module.exports = createRunOncePlugin(
  withHealthkitBackgroundObservers,
  'with-healthkit-background-observers',
  '1.0.0',
)
