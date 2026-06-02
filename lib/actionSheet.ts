import { ActionSheetIOS, Alert, Platform } from 'react-native'

/*
 * Cross-platform action sheet.
 *
 * `ActionSheetIOS` is iOS-only — calling it on Android throws / no-ops,
 * which silently breaks any flow that relies on it (e.g. "registrar
 * comida con foto"). This wraps it so the same call works on both:
 *   - iOS     → the native ActionSheetIOS.
 *   - Android → an Alert with one button per option, preserving the
 *               original index so the callback contract is identical.
 *
 * The callback always receives the index into `options` (including the
 * cancel index), exactly like ActionSheetIOS, so call sites don't branch
 * on platform.
 */
type ActionSheetConfig = {
  title?: string
  message?: string
  options: string[]
  cancelButtonIndex: number
  destructiveButtonIndex?: number
}

export function showActionSheet(
  config: ActionSheetConfig,
  callback: (index: number) => void,
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: config.title,
        message: config.message,
        options: config.options,
        cancelButtonIndex: config.cancelButtonIndex,
        destructiveButtonIndex: config.destructiveButtonIndex,
      },
      callback,
    )
    return
  }

  // Android & others: map each option to an Alert button, keeping the
  // option index intact. The cancel option becomes a 'cancel'-styled
  // button so it reads apart, matching the iOS layout. Dismissing by
  // tapping outside is equivalent to cancel (no callback fires).
  const buttons = config.options.map((label, index) => {
    if (index === config.cancelButtonIndex) {
      return { text: label, style: 'cancel' as const, onPress: () => callback(index) }
    }
    return {
      text: label,
      style:
        index === config.destructiveButtonIndex ? ('destructive' as const) : ('default' as const),
      onPress: () => callback(index),
    }
  })

  Alert.alert(config.title ?? '', config.message, buttons, { cancelable: true })
}
