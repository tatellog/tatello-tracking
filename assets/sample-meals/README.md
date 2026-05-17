# Sample meal photos (dev only)

Drop 3 food photos here so the meal circles on "Hoy" preview with real
images before the scan-meal upload fills them in for real.

Expected files — exact names:

```
meal-1.jpg
meal-2.jpg
meal-3.jpg
```

Then open `features/macros/sampleMealPhotos.ts` and uncomment the three
`require(...)` lines.

These are bundled only in development (`__DEV__`); production shows only
the real photos uploaded by the scan-meal flow.
