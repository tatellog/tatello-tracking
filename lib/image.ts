import * as ImageManipulator from 'expo-image-manipulator'

// Cap for a picked photo's longest displayed edge. A camera capture can
// be 12MP; shown in a ~200px circle that's pure wasted memory. 1280 is
// plenty for both display and the vision scan (the upload path resizes
// again for storage). Resize ONCE at pick time so the full-res original
// is never held just to be downscaled by the view.
const DISPLAY_MAX_WIDTH = 1280

/*
 * Downscale a picked image to DISPLAY_MAX_WIDTH. Pass the source width
 * (from the ImagePicker asset) so we skip work — and avoid UPSCALING —
 * when the image is already small enough. Best-effort: on any failure
 * the original uri is returned, so a manipulation error never blocks a
 * log.
 */
export async function resizeForDisplay(uri: string, sourceWidth?: number): Promise<string> {
  if (sourceWidth && sourceWidth <= DISPLAY_MAX_WIDTH) return uri
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: DISPLAY_MAX_WIDTH } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    )
    return result.uri
  } catch {
    return uri
  }
}
