import { BlurView } from 'expo-blur'
import { TextInput } from 'react-native'
import Animated from 'react-native-reanimated'
import { Circle, G, Line } from 'react-native-svg'

export const AnimatedCircle = Animated.createAnimatedComponent(Circle)
export const AnimatedG = Animated.createAnimatedComponent(G)
export const AnimatedLine = Animated.createAnimatedComponent(Line)
export const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)
export const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)
