import { StyleSheet, View } from 'react-native'

import { colors } from '@/theme'

import { StarLoader } from './StarLoader'

/*
 * Full-page loading — a silhouette of the screen's layout with the loader
 * resolving on top. The softening used to be an expo-blur BlurView over the
 * skeleton, but on Android that renders as a SOLID BLACK pane (intensity 38) —
 * it hid the whole skeleton, so the loading state read as "negro total". Now a
 * light translucent wash softens the silhouette instead (cheaper, and shows on
 * both platforms). Drop it inside a screen's content area.
 */
export function LoadingView() {
  return (
    <View style={styles.root}>
      {/* A rough silhouette of the page — soft surfaces under a translucent
          wash so they read as the app out of focus, not hard cards. */}
      <View style={styles.skeleton}>
        <View style={[styles.block, styles.header]} />
        <View style={[styles.block, styles.cta]} />
        <View style={[styles.block, styles.label]} />
        <View style={[styles.block, styles.hero]} />
        <View style={[styles.block, styles.line]} />
        <View style={[styles.block, styles.strip]} />
      </View>
      <View style={[StyleSheet.absoluteFill, styles.wash]} pointerEvents="none" />
      <View style={styles.center} pointerEvents="none">
        <StarLoader size={48} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Light translucent wash over the skeleton — softens the silhouette so it
  // reads as the app out of focus, WITHOUT hiding it the way the old Android
  // BlurView (solid black) did. Low alpha keeps the blocks legible.
  wash: {
    backgroundColor: 'rgba(10,6,8,0.35)',
  },
  skeleton: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  block: {
    backgroundColor: colors.bgCard2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  header: {
    width: '52%',
    height: 30,
  },
  // The CTA — magenta-tinted so the blur carries the app's accent.
  cta: {
    width: '100%',
    height: 58,
    marginTop: 22,
    backgroundColor: colors.magentaTint2,
    borderColor: colors.magenta,
  },
  label: {
    width: '34%',
    height: 14,
    marginTop: 26,
  },
  hero: {
    width: '100%',
    height: 158,
    marginTop: 12,
  },
  line: {
    width: '82%',
    height: 15,
    marginTop: 18,
  },
  strip: {
    width: '100%',
    height: 60,
    marginTop: 22,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
