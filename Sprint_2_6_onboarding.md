# Sprint 2.6 — Onboarding completo (FINAL)

**Tipo:** Feature sprint completo con ceremonia de bienvenida.
**Objetivo:** Que un user nuevo viva un flujo emocional desde welcome hasta el primer Home, capturando los 5 datos imprescindibles + 4 fotos de "antes".

## Prerequisitos

- Sprint Estabilización completo (app sin bugs críticos, dev user funcional)
- Schema de `profiles` necesita columnas adicionales (Tarea A.1)
- Schema de `photos` debe existir (Tarea A.2 lo verifica/crea)

## Decisiones tomadas (referencia)

- 5 campos imprescindibles: nombre, fecha de nacimiento, género biológico, altura, peso
- Multi-step wizard, una pantalla por dato
- Pantalla Done elaborada con check + frase aspiracional + halo
- Pantalla Día 1 puente entre Done y Home con perfil resumido + card de fotos + 3 tasks
- 4 fotos de progreso (frente, lateral derecho, lateral izquierdo, espalda) como CTA destacado en Día 1, no obligatorio
- Home primera apertura con animación germinate del tile gigante + shimmer + banner Día 1
- Recordatorio de fotos cada 30 días

## Total de pantallas

```
1. Welcome
2. Nombre (paso 1 de 6)
3. Fecha de nacimiento (paso 2 de 6)
4. Género biológico (paso 3 de 6)
5. Altura (paso 4 de 6)
6. Peso (paso 5 de 6)
7. Objetivo (paso 6 de 6)
8. Done
9. Día 1
10-13. Photo wizard (4 ángulos) — opcional, accedido desde Día 1
14. Photo wizard done
```

Después del flow viene macro-targets opcional (Sprint 2.5, ya implementado, no se modifica).

---

## Stack adicional

```bash
pnpm add expo-camera expo-image-manipulator expo-linear-gradient @react-native-masked-view/masked-view
```

- `expo-camera` — captura nativa con preview
- `expo-image-manipulator` — resize/compress antes de upload
- `expo-linear-gradient` — gradients de fondo del wizard
- `@react-native-masked-view/masked-view` — clip-text gradient en el "365" del welcome (opcional, ver Tarea C.1)

Lo demás ya está: `react-native-reanimated`, `react-hook-form`, `zod`, `@react-native-community/datetimepicker`, fonts, async-storage.

---

## Tareas en orden

### Bloque A — Schema y setup base

#### A.1 — Extender schema de profiles

```sql
-- supabase migration new extend_profiles_onboarding
alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists biological_sex text check (biological_sex in ('female', 'male')),
  add column if not exists height_cm int check (height_cm > 50 and height_cm < 250),
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists first_workout_at timestamptz;
```

`first_workout_at` se setea automáticamente con trigger:

```sql
create or replace function public.set_first_workout_at()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.profiles
  set first_workout_at = new.completed_at
  where id = new.user_id
    and first_workout_at is null;
  return new;
end;
$$;

create trigger trg_set_first_workout_at
  after insert on public.workouts
  for each row
  execute function public.set_first_workout_at();
```

Se usa para detectar "primera apertura del Home" (estado especial Día 1).

Regenerar tipos: `pnpm types:db`.

#### A.2 — Verificar/crear schema de photos

```sql
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  angle text not null check (angle in ('front', 'side_right', 'side_left', 'back')),
  storage_path text not null,
  width int,
  height int,
  byte_size int,
  created_at timestamptz not null default now()
);

create index if not exists photos_user_taken_at_idx on public.photos (user_id, taken_at desc);
create index if not exists photos_user_angle_idx on public.photos (user_id, angle, taken_at desc);

alter table public.photos enable row level security;

create policy photos_owner_select on public.photos
  for select using (auth.uid() = user_id);
create policy photos_owner_insert on public.photos
  for insert with check (auth.uid() = user_id);
create policy photos_owner_delete on public.photos
  for delete using (auth.uid() = user_id);
```

#### A.3 — Bucket de Supabase Storage

En Supabase dashboard:

1. Storage → New bucket → name: `progress-photos`
2. Public: NO (bucket privado)
3. File size limit: 5 MB
4. Allowed MIME types: `image/jpeg, image/png`

Policies SQL:

```sql
create policy "Users can view own photos"
on storage.objects for select
using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload own photos"
on storage.objects for insert
with check (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own photos"
on storage.objects for delete
using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

Path convention: `{user_id}/{timestamp}_{angle}.jpg`
Ejemplo: `abc-123-uuid/1727456000_front.jpg`

#### A.4 — Estructura de archivos

```
/app/onboarding/
  _layout.tsx
  welcome.tsx
  name.tsx
  date-of-birth.tsx
  biological-sex.tsx
  height.tsx
  weight.tsx
  goal.tsx
  done.tsx
  day-one.tsx
  /photos/
    _layout.tsx
    [angle].tsx
    done.tsx

/features/onboarding/
  /components/
    WizardLayout.tsx
    ProgressBar.tsx
    StepHeader.tsx
    SelectableCard.tsx
    NumberInput.tsx
    OrnamentShape.tsx
  /photos/
    /components/
      SilhouetteFront.tsx
      SilhouetteSide.tsx
      SilhouetteBack.tsx
      CameraView.tsx
      ThumbnailRow.tsx
      PhotoCaptureCard.tsx
    /hooks/
      useTakePhoto.ts
      usePhotosToday.ts
      useLatestPhotoSet.ts

/features/profile/
  /hooks/
    useProfile.ts
    useUpdateProfile.ts
```

`/app/onboarding/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'
import { colors } from '@/theme/colors'

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.pearlBase },
      }}
    />
  )
}
```

#### A.5 — Agregar tokens nuevos al theme

En `/theme/colors.ts`, agregar:

```ts
export const colors = {
  // ... existentes ...

  // NUEVOS para Sprint 2.6
  pearlGradientEnd: '#F5EFF2', // bottom del gradient sutil del wizard
  mauveTinted: '#F8F0F4', // bg de selectable cards seleccionadas
  mauveBorderSoft: '#D8B5C4', // border dashed de photo slots vacíos
  cameraDark: '#2A2530', // top del gradient de cámara
  cameraDarkBottom: '#1F1A24', // bottom del gradient de cámara
} as const
```

---

### Bloque B — Componentes compartidos del wizard

#### B.1 — WizardLayout

`/features/onboarding/components/WizardLayout.tsx`:

Wrapper común a los pasos 2-7. Provee SafeArea, ProgressBar, content centrado, footer con botones.

```tsx
type WizardLayoutProps = {
  step: number
  totalSteps: number
  showBack?: boolean // default true
  canContinue: boolean
  onContinue: () => void
  onBack?: () => void
  children: React.ReactNode
  continueLabel?: string // default "Continuar →"
  showOrnaments?: boolean // default true
  ornamentVariant?: 'tr' | 'bl' | 'tl-small' | 'br' // posición de la forma
}
```

Estructura interna:

- SafeAreaView con bg `pearlBase`
- LinearGradient absolute filling: `[colors.pearlBase, colors.pearlGradientEnd]`
- Si `showOrnaments`, `OrnamentShape` con la variante indicada
- ProgressBar arriba (padding 22px horizontal, top 22)
- Content area con padding 24 horizontal, padding top 32, flex 1
- Footer fijo con "‹ Atrás" izquierda + "Continuar →" derecha

#### B.2 — OrnamentShape

`/features/onboarding/components/OrnamentShape.tsx`:

Forma circular con radial-gradient malva translúcido. Se anima `pulseBg` con Reanimated.

```tsx
type OrnamentShapeProps = {
  variant: 'tr' | 'bl' | 'tl-small' | 'br'
  size?: number // default según variante
}
```

Posiciones por variante:

- `tr`: top -50, right -60, size 200
- `bl`: bottom 100, left -40, size 140
- `tl-small`: top -40, left -50, size 160
- `br`: bottom 80, right -60, size 180

Implementación: View absolute con `borderRadius: 999`, background `radial-gradient` simulado con expo-linear-gradient o usando `<Svg>` con `<RadialGradient>`. RN no soporta radial-gradient nativo en `backgroundColor`.

Solución pragmática: usar `<Svg>` con `<RadialGradient>` y `<Circle>`:

```tsx
import Svg, { Circle, Defs, RadialGradient as SvgRadial, Stop } from 'react-native-svg'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

function OrnamentShape({ variant, size = 200 }: OrnamentShapeProps) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.1, { duration: 4000 }), -1, true)
    opacity.value = withRepeat(withTiming(0.4, { duration: 4000 }), -1, true)
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[positionByVariant[variant], { width: size, height: size }, animStyle]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgRadial id="grad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.mauveDeep} stopOpacity="0.13" />
            <Stop offset="70%" stopColor={colors.mauveDeep} stopOpacity="0" />
          </SvgRadial>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#grad)" />
      </Svg>
    </Animated.View>
  )
}
```

#### B.3 — ProgressBar

`/features/onboarding/components/ProgressBar.tsx`:

```tsx
type ProgressBarProps = {
  current: number
  total: number
}
```

Layout: row con N segmentos `flex: 1`, gap 4, height 3. Cada segmento `borderRadius: 1.5`. Filled `mauveDeep`, empty `borderSubtle`.

Sin animación en v1.

#### B.4 — StepHeader

`/features/onboarding/components/StepHeader.tsx`:

```tsx
type StepHeaderProps = {
  eyebrow?: string
  eyebrowColor?: 'mauve' | 'muted' // default 'muted'
  question: string
  questionEmphasis?: string
  hint?: string
}
```

Render del eyebrow:

- Inter UI 10px, weight 600, letter-spacing 2.4
- Si es nombre del user (ej "Sofía,"): `text-transform: none`, color `mauveDeep`
- Si es texto narrativo ("Para conocernos"): `text-transform: uppercase`, color según `eyebrowColor`

Render de la pregunta:

- Inter Tight Light 28px, letter-spacing -1.2, line-height 1.15
- Si hay `questionEmphasis`, esa palabra/frase se renderiza con weight 500 + color `mauveDeep`

Helper `renderWithEmphasis(text, emphasis)`:

```ts
function renderWithEmphasis(text: string, emphasis: string) {
  const regex = new RegExp(`(${emphasis})`, 'i')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    part.toLowerCase() === emphasis.toLowerCase() ? (
      <Text key={i} style={{ color: colors.mauveDeep, fontWeight: '500' }}>
        {part}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    )
  )
}
```

#### B.5 — SelectableCard

`/features/onboarding/components/SelectableCard.tsx`:

```tsx
type SelectableCardProps = {
  label: string
  description?: string // solo para variant 'row'
  icon?: string // solo para variant 'square'
  selected: boolean
  onPress: () => void
  variant: 'square' | 'row'
}
```

Variantes:

- `square`: aspect-ratio 1, ícono grande arriba (Inter Tight 30px Light) + label abajo
- `row`: full-width, padding 11px 13px, label arriba weight 600 + description debajo

Estados:

- Unselected: bg `pearlElevated`, border 0.5px `borderSubtle`
- Selected: bg `mauveTinted`, border 1.5px `mauveDeep`

Haptic Selection al press.

#### B.6 — NumberInput

`/features/onboarding/components/NumberInput.tsx`:

```tsx
type NumberInputProps = {
  value: string
  onChangeText: (v: string) => void
  unit: string
  placeholder?: string
  decimal?: boolean
  autoFocus?: boolean
}
```

Layout: row con baseline alignment. Inter Tight 56px Light para número, Inter Medium 14px para unidad. Border-bottom 1px `mauveDeep` cuando focus, `borderSubtle` cuando blur.

`keyboardType`: si `decimal`, `decimal-pad`; else `number-pad`.

---

### Bloque C — Pasos del wizard principal

#### C.1 — Welcome

`/app/onboarding/welcome.tsx`:

Sin progress bar. Centered.

Contenido:

1. Stat grande: "365" en Inter Tight 200 80px letter-spacing -3, con gradient negro→malva (clip-text con MaskedView)
2. Stat sub: "DÍAS POR DELANTE" en Inter UI 11px, weight 600, letter-spacing 2, uppercase, color `labelMuted`
3. Título: "Tu cuerpo se transforma cada día." con "cada día" en `mauveDeep` weight 500, Inter Tight Light 30px
4. Subtítulo: "Vamos a empezar a notarlo. Toma menos de un minuto conocernos."
5. CTA full-width: "Empecemos"

Implementación del clip-text:

```tsx
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
;<MaskedView maskElement={<Text style={styles.bigNumber}>365</Text>} style={{ height: 80 }}>
  <LinearGradient
    colors={[colors.inkPrimary, colors.mauveDeep]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={{ flex: 1 }}
  />
</MaskedView>
```

Si MaskedView pelea, fallback: text sólido en `inkPrimary` con `fontWeight: 200`.

OrnamentShape variant `tr` + `bl` para fondo dinámico.

Tap en "Empecemos" → `router.push('/onboarding/name')`.

#### C.2 — Nombre

`/app/onboarding/name.tsx`:

Wizard step 1 de 6. OrnamentShape `tr`.

```tsx
<WizardLayout step={1} totalSteps={6} showBack={false} ...>
  <StepHeader
    eyebrow="Para conocernos"
    eyebrowColor="mauve"
    question="¿Cómo te llamas?"
    questionEmphasis="llamas"
    hint="Para personalizar tus notas y que la app sepa quién eres."
  />
  <TextInput
    value={name}
    onChangeText={setName}
    autoFocus
    autoCorrect={false}
    maxLength={40}
    style={styles.inputLine}
  />
</WizardLayout>
```

Style del input:

- Border-bottom 1px `mauveDeep`
- Padding 8px 0 12px
- Inter Tight 28px Light, letter-spacing -1, color `inkPrimary`
- Background transparent

Validación zod: `z.string().trim().min(1).max(40)`.

`canContinue` = `name.trim().length > 0`.

Al continuar:

1. `await updateProfile.mutateAsync({ display_name: name.trim() })`
2. `router.push('/onboarding/date-of-birth')`

#### C.3 — Fecha de nacimiento

`/app/onboarding/date-of-birth.tsx`:

Wizard step 2 de 6. OrnamentShape `tl-small`.

```tsx
<WizardLayout step={2} totalSteps={6} ...>
  <StepHeader
    eyebrow={`${profile.display_name},`}
    eyebrowColor="mauve"  // pero override transform a 'none' en el StepHeader (caso especial)
    question="¿cuándo naciste?"
    questionEmphasis="naciste"
    hint="Esto nos ayuda a calcular tu metabolismo."
  />
  <DateTimePicker
    value={date}
    mode="date"
    display="spinner"
    minimumDate={minDate}
    maximumDate={maxDate}
    onChange={...}
  />
  <Text style={styles.computedAge}>
    <Text style={{ color: colors.inkPrimary, fontWeight: '500' }}>
      {calculateAge(date)} años
    </Text>
  </Text>
</WizardLayout>
```

Default date: hace 30 años. Min: hace 100 años. Max: hace 13 años.

Helper `calculateAge`:

```ts
function calculateAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}
```

Al continuar: `update profiles.date_of_birth = date.toISOString().split('T')[0]`, navigate a `/biological-sex`.

#### C.4 — Género biológico

`/app/onboarding/biological-sex.tsx`:

Wizard step 3 de 6. OrnamentShape `tr`.

```tsx
<WizardLayout step={3} totalSteps={6} ...>
  <StepHeader
    eyebrow="Una más"
    eyebrowColor="muted"
    question="¿Tu sexo biológico?"
    questionEmphasis="biológico"
    hint="Es solo para calcular tu metabolismo. No define tu identidad."
  />
  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
    <SelectableCard
      label="Femenino"
      icon="♀"
      selected={selected === 'female'}
      onPress={() => setSelected('female')}
      variant="square"
    />
    <SelectableCard
      label="Masculino"
      icon="♂"
      selected={selected === 'male'}
      onPress={() => setSelected('male')}
      variant="square"
    />
  </View>
</WizardLayout>
```

`canContinue` = `selected !== null`.

Al continuar: `update profiles.biological_sex`, navigate a `/height`.

#### C.5 — Altura

`/app/onboarding/height.tsx`:

Wizard step 4 de 6. OrnamentShape `bl`.

```tsx
<WizardLayout step={4} totalSteps={6} ...>
  <StepHeader
    eyebrow="Vamos bien"
    eyebrowColor="muted"
    question="¿Cuánto mides?"
    questionEmphasis="mides"
    hint="En centímetros."
  />
  <NumberInput
    value={height}
    onChangeText={setHeight}
    unit="cm"
    placeholder="165"
    decimal={false}
    autoFocus
  />
  {!isValid && height.length > 0 && (
    <Text style={styles.errorMsg}>Entre 130 y 220 cm.</Text>
  )}
</WizardLayout>
```

Validación: `130 ≤ value ≤ 220`. Mensaje error en `feedbackError` 11px debajo del input.

Al continuar: `update profiles.height_cm`, navigate a `/weight`.

#### C.6 — Peso

`/app/onboarding/weight.tsx`:

Wizard step 5 de 6. OrnamentShape `tl-small`.

Esta pantalla es ESPECIAL — tiene la card de contexto futuro.

```tsx
<WizardLayout step={5} totalSteps={6} ...>
  <StepHeader
    eyebrow="El punto de partida"
    eyebrowColor="mauve"
    question="Hoy pesas..."
    questionEmphasis="pesas"
    hint="Solo el comienzo. Cambiará — eso es lo que vamos a ver juntas."
  />
  <NumberInput
    value={weight}
    onChangeText={setWeight}
    unit="kg"
    placeholder="70"
    decimal={true}
    autoFocus
  />
  <View style={styles.contextCard}>
    <Text style={styles.contextEyebrow}>Próximo capítulo</Text>
    <Text style={styles.contextText}>
      En 4 semanas verás tu primera comparativa. En 12 semanas, el cambio será evidente.
    </Text>
  </View>
</WizardLayout>
```

Style de la card de contexto:

- Background `rgba(168, 94, 124, 0.08)`
- Border-radius 14, padding 14px 18px
- `marginTop: 'auto'` (empuja la card al fondo del content area)
- `marginBottom: 14`
- Eyebrow: Inter UI 9px weight 600 letter-spacing 2 uppercase color `mauveDeep`
- Text: Inter UI 12px line-height 1.5 color `inkPrimary`

Validación: `30 ≤ value ≤ 300`.

Al continuar:

1. Insert en `body_measurements` con `weight_kg: weightNumber, measured_at: now()`
2. `queryClient.invalidateQueries(['briefContext'])`
3. Si `profile.goal` es null → navigate a `/goal`
4. Si ya tiene goal → navigate a `/done`

Es importante notar que `weight_kg` NO va a `profiles` — va a `body_measurements`. Esto preserva el histórico desde día 1.

#### C.7 — Objetivo

`/app/onboarding/goal.tsx`:

Wizard step 6 de 6. OrnamentShape `tr`.

```tsx
<WizardLayout step={6} totalSteps={6} ...>
  <StepHeader
    eyebrow="Última pieza"
    eyebrowColor="mauve"
    question="¿Qué quieres lograr?"
    questionEmphasis="quieres lograr"
    hint="Esto guía cómo te sugerimos comer y entrenar."
  />
  <View style={{ flexDirection: 'column', gap: 7, marginTop: 4 }}>
    {GOALS.map(goal => (
      <SelectableCard
        key={goal.value}
        label={goal.label}
        description={goal.desc}
        selected={selected === goal.value}
        onPress={() => setSelected(goal.value)}
        variant="row"
      />
    ))}
  </View>
</WizardLayout>
```

```ts
const GOALS = [
  {
    value: 'recomposition',
    label: 'Recomposición',
    desc: 'Ganar músculo y bajar grasa al mismo tiempo.',
  },
  { value: 'lose_fat', label: 'Bajar grasa', desc: 'Perder peso priorizando grasa.' },
  { value: 'gain_muscle', label: 'Ganar músculo', desc: 'Subir peso priorizando músculo.' },
  { value: 'maintain', label: 'Mantener', desc: 'Mantener mi físico actual.' },
] as const
```

Al continuar: `update profiles.goal`, navigate a `/done`.

#### C.8 — Done

`/app/onboarding/done.tsx`:

Sin progress bar. Pantalla de celebración.

```tsx
<View style={styles.container}>
  <LinearGradient colors={[pearlBase, pearlGradientEnd]} style={StyleSheet.absoluteFill} />
  <OrnamentShape variant="tr" />

  <View style={styles.content}>
    <View style={styles.checkWrap}>
      <Animated.View style={[styles.haloRing, haloAnimStyle]} />
      <Animated.View style={[styles.checkCircle, checkAnimStyle]}>
        <Text style={styles.checkIcon}>✓</Text>
      </Animated.View>
    </View>

    <Text style={styles.doneTitle}>
      Listo, <Text style={styles.titleEmphasis}>{profile.display_name}</Text>.
    </Text>
    <Text style={styles.doneSub}>
      Tu perfil queda en su lugar.{'\n'}
      Lo que sigue lo construyes tú.
    </Text>
  </View>

  <Pressable onPress={handleContinue} style={styles.ctaFull}>
    <Text style={styles.ctaLabel}>Continuar</Text>
  </Pressable>
</View>
```

Animaciones:

```ts
// Check entrance
const checkScale = useSharedValue(0)
useEffect(() => {
  checkScale.value = withSequence(
    withTiming(1.15, { duration: 400, easing: Easing.bezierFn(0.34, 1.56, 0.64, 1) }),
    withSpring(1, { stiffness: 100, damping: 12 }),
  )
}, [])
const checkAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: checkScale.value }],
}))

// Halo ring infinito
const haloScale = useSharedValue(1)
const haloOpacity = useSharedValue(0.85)
useEffect(() => {
  haloScale.value = withRepeat(withTiming(2.5, { duration: 2400 }), -1, false)
  haloOpacity.value = withRepeat(withTiming(0, { duration: 2400 }), -1, false)
}, [])
```

Estilos:

- `checkCircle`: 72x72, borderRadius 36, gradient `mauveLight → mauveDeep`, box-shadow malva, color `pearlBase`, fontSize 30, font Inter Tight Light
- `haloRing`: absolute, inset -6, borderRadius 50%, border 2px `mauveDeep`
- `doneTitle`: Inter Tight Light 36px, letter-spacing -1.4, color `inkPrimary`
- `titleEmphasis`: weight 500, color `mauveDeep`
- `doneSub`: Inter UI 14px, line-height 1.55, color `labelMuted`

Al tap "Continuar":

1. `await updateProfile.mutateAsync({ onboarding_completed_at: new Date().toISOString() })`
2. `router.replace('/onboarding/day-one')` (replace para que back no regrese aquí)

---

### Bloque D — Día 1 (la ceremonia)

#### D.1 — Layout principal

`/app/onboarding/day-one.tsx`:

Sin progress bar, sin back button.

```tsx
<ScrollView style={styles.container}>
  <LinearGradient colors={[pearlBase, pearlGradientEnd]} style={StyleSheet.absoluteFill} />
  <OrnamentShape variant="tl-small" />

  <SafeAreaView edges={['top']} style={styles.safeContent}>
    <View style={styles.content}>
      <Text style={styles.eyebrow}>Tu primer día</Text>
      <Text style={styles.title}>
        Hoy <Text style={styles.titleEmphasis}>empieza</Text>.
      </Text>
      <Text style={styles.sub}>Aquí está lo que te hará despegar.</Text>

      <ProfileSummaryCard profile={profile} weight={latestWeight} />

      <PhotoCaptureCard capturedPhotos={photosToday} onStartCapture={handleStartPhotos} />

      <View style={styles.tasksList}>
        {DAY_ONE_TASKS.map((t) => (
          <DayOneTask key={t.num} num={t.num} text={t.text} />
        ))}
      </View>
    </View>
  </SafeAreaView>

  <SafeAreaView edges={['bottom']}>
    <Pressable onPress={handleEnter} style={styles.ctaFull}>
      <Text style={styles.ctaLabel}>Entrar a la app →</Text>
    </Pressable>
  </SafeAreaView>
</ScrollView>
```

Estilos del título:

- `eyebrow`: Inter UI 10px weight 600 letter-spacing 2.4 uppercase color `mauveDeep`
- `title`: Inter Tight Light 36px letter-spacing -1.4 line-height 1.05 color `inkPrimary`
- `titleEmphasis`: weight 500 (no cambia color, se queda en `inkPrimary`)
- `sub`: Inter UI 13px line-height 1.55 color `labelMuted`

#### D.2 — ProfileSummaryCard

`/features/onboarding/components/ProfileSummaryCard.tsx`:

```tsx
type ProfileSummaryCardProps = {
  profile: Profile
  weight: number
}

export function ProfileSummaryCard({ profile, weight }: ProfileSummaryCardProps) {
  const age = calculateAge(new Date(profile.date_of_birth))

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Tu perfil</Text>
      <View style={styles.grid2x2}>
        <ProfileItem label="Edad" value={`${age} años`} />
        <ProfileItem label="Altura" value={`${profile.height_cm} cm`} />
        <ProfileItem label="Peso" value={`${weight} kg`} />
        <ProfileItem label="Objetivo" value={localizeGoal(profile.goal)} />
      </View>
    </View>
  )
}
```

Estilos:

- `card`: bg `pearlElevated`, border 0.5px `borderSubtle`, borderRadius 14, padding 12px 14px, marginBottom 12
- `cardLabel`: Inter UI 9px weight 600 letter-spacing 2 uppercase color `labelDim`
- `grid2x2`: display grid 1fr 1fr, gap 8px 14px
- ProfileItem key: Inter UI 9px weight 500 letter-spacing 1.3 uppercase color `labelDim`
- ProfileItem val: Inter Tight 13px weight 400 letter-spacing -0.3 color `inkPrimary`

#### D.3 — PhotoCaptureCard (DESTACADA)

`/features/onboarding/photos/components/PhotoCaptureCard.tsx`:

```tsx
type PhotoCaptureCardProps = {
  capturedPhotos: Array<{ angle: PhotoAngle; uri?: string }> // signed URLs
  onStartCapture: () => void
}
```

Estructura visual:

```tsx
<View style={styles.photoCard}>
  <Animated.View style={[styles.shimmer, shimmerStyle]}>
    <LinearGradient
      colors={['transparent', 'rgba(168, 94, 124, 0.08)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  </Animated.View>

  <Text style={styles.eyebrow}>Recomendado</Text>
  <Text style={styles.title}>
    Captura tu <Text style={styles.titleEmphasis}>antes</Text>.
  </Text>
  <Text style={styles.sub}>
    4 fotos hoy para comparar en 30 días. La diferencia visual es donde el cambio se ve real.
  </Text>

  <View style={styles.slotsGrid}>
    {(['front', 'side_right', 'side_left', 'back'] as const).map((angle) => (
      <PhotoSlot key={angle} angle={angle} photo={capturedPhotos.find((p) => p.angle === angle)} />
    ))}
  </View>

  <Pressable onPress={onStartCapture} style={styles.cta}>
    <Text style={styles.ctaLabel}>{ctaCopy}</Text>
  </Pressable>
</View>
```

Estilos:

- `photoCard`:
  - Background gradient `linear-gradient(135deg, ${pearlElevated} 0%, #FCF7F9 100%)`
  - Para gradient en RN: usar LinearGradient como child absolute
  - Border 1.5px `mauveDeep` (destacado vs ProfileCard que tiene 0.5px)
  - BorderRadius 16
  - Padding 14
  - Position relative + overflow hidden (para el shimmer)
  - MarginBottom 12

- `shimmer`: View absolute fill, animación que mueve `translateX` de -150% a 150% cada 3s con `withRepeat`. Cuando capturedPhotos.length === 4, desactivar shimmer (no más animación).

- `eyebrow`: Inter UI 9px weight 600 letter-spacing 2 uppercase color `mauveDeep`
- `title`: Inter Tight 18px weight 400 letter-spacing -0.5 color `inkPrimary`
- `titleEmphasis`: weight 500 color `mauveDeep`
- `sub`: Inter UI 11.5px line-height 1.5 color `labelMuted`

- `slotsGrid`: display grid 2x2, gap 6, marginBottom 12

- `cta`: gradient `mauveLight → mauveDeep`, padding 10, borderRadius 100, color blanco, Inter Medium 12.5px letter-spacing 0.3, box-shadow malva sutil

PhotoSlot component:

```tsx
function PhotoSlot({ angle, photo }: { angle: PhotoAngle; photo?: { uri: string } }) {
  if (photo) {
    return (
      <View style={styles.slotFilled}>
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} />
        <View style={styles.checkOverlay}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.slotEmpty}>
      <Text style={styles.slotIcon}>＋</Text>
      <Text style={styles.slotLabel}>{ANGLE_LABELS[angle]}</Text>
    </View>
  )
}

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: 'Frente',
  side_right: 'Lateral D',
  side_left: 'Lateral I',
  back: 'Espalda',
}
```

CTA copy adaptativo:

```ts
const ctaCopy = useMemo(() => {
  const captured = capturedPhotos.filter((p) => p.uri).length
  if (captured === 0) return 'Empezar fotos →'
  if (captured < 4) return `Continuar fotos (${captured}/4) →`
  return 'Volver a tomar'
}, [capturedPhotos])
```

#### D.4 — DayOneTask

```tsx
function DayOneTask({ num, text }: { num: number; text: string }) {
  return (
    <View style={styles.task}>
      <View style={styles.taskNum}>
        <Text style={styles.taskNumText}>{num}</Text>
      </View>
      <Text style={styles.taskText}>{text}</Text>
    </View>
  )
}
```

Estilos:

- `task`: row, gap 10, padding 9px 12px, bg `pearlElevated`, border 0.5px `borderSubtle`, borderRadius 12
- `taskNum`: 20x20, borderRadius 50%, bg `pearlMuted`, center contents
- `taskNumText`: Inter Tight 10px weight 500 color `mauveDeep`
- `taskText`: Inter UI 12px weight 500 color `inkPrimary`

#### D.5 — handleEnter

```ts
async function handleEnter() {
  await markVisitedDayOne()
  router.replace('/(tabs)/index')
}
```

`markVisitedDayOne`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = '@app:visited_day_one'

export async function markVisitedDayOne() {
  await AsyncStorage.setItem(KEY, 'true')
}

export function useVisitedDayOne() {
  const [visited, setVisited] = useState<boolean | null>(null)
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setVisited(v === 'true'))
  }, [])
  return visited
}
```

---

### Bloque E — Photo wizard (4 ángulos)

#### E.1 — Layout y routing

`/app/onboarding/photos/_layout.tsx`:

```tsx
export default function PhotosLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    />
  )
}
```

`/app/onboarding/photos/[angle].tsx`:

Dynamic route. El param `angle` debe ser uno de los 4 valores válidos. Si es inválido, redirect a `/onboarding/day-one`.

```ts
const PHOTO_ORDER: PhotoAngle[] = ['front', 'side_right', 'side_left', 'back']

export default function PhotoStep() {
  const { angle } = useLocalSearchParams<{ angle: PhotoAngle }>()

  if (!PHOTO_ORDER.includes(angle)) {
    return <Redirect href="/onboarding/day-one" />
  }

  const config = PHOTO_CONFIG[angle]
  const stepNumber = PHOTO_ORDER.indexOf(angle) + 1

  return (
    <PhotoWizardScreen
      angle={angle}
      stepNumber={stepNumber}
      config={config}
    />
  )
}
```

#### E.2 — PhotoWizardScreen

```tsx
function PhotoWizardScreen({ angle, stepNumber, config }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const router = useRouter()

  if (!permission) return <SplashScreen />
  if (!permission.granted) {
    return <PermissionDeniedView onGrant={requestPermission} />
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const photo = await cameraRef.current.takePictureAsync({
      quality: 1,
      skipProcessing: false,
    })

    if (!photo) return

    try {
      await processAndUpload(photo.uri, angle)
    } catch (err) {
      console.error('Photo upload failed:', err)
      Alert.alert('Error', 'No pudimos subir la foto. Intenta otra vez.')
      return
    }

    const nextAngle = getNextAngle(angle)
    if (nextAngle) {
      router.replace(`/onboarding/photos/${nextAngle}`)
    } else {
      router.replace('/onboarding/photos/done')
    }
  }

  const handleSkip = () => {
    Alert.alert(
      '¿Saltar las fotos?',
      'Podrás capturarlas después desde Día 1 o Settings, pero hoy es el "antes" perfecto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Saltar',
          style: 'destructive',
          onPress: () => router.replace('/onboarding/day-one'),
        },
      ],
    )
  }

  return (
    <View style={styles.container}>
      <ProgressBar current={stepNumber} total={4} />

      <Text style={styles.eyebrow}>Foto {stepNumber} de 4</Text>
      <Text style={styles.title}>
        <Text style={styles.titleEmphasis}>{config.title}</Text>
      </Text>
      <Text style={styles.instruction}>{config.instruction}</Text>

      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        <View style={styles.cornerMarks}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <View style={styles.silhouetteContainer}>
          <SilhouetteRenderer angle={angle} />
        </View>

        {config.rotationHint && (
          <View style={styles.rotationHint}>
            <Text style={styles.rotationHintText}>{config.rotationHint}</Text>
          </View>
        )}

        <Text style={styles.overlayText}>{config.overlayHint}</Text>
      </View>

      <View style={styles.captureRow}>
        <ThumbnailRow currentStep={stepNumber} />
        <CaptureButton onPress={handleCapture} />
        <Text style={styles.meta}>
          <Text style={styles.metaNum}>{stepNumber}</Text> de 4
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Atrás</Text>
        </Pressable>
        <Pressable onPress={handleSkip}>
          <Text style={styles.skip}>Saltar</Text>
        </Pressable>
      </View>
    </View>
  )
}
```

`PHOTO_CONFIG`:

```ts
const PHOTO_CONFIG: Record<PhotoAngle, PhotoStepConfig> = {
  front: {
    title: 'Frente',
    instruction: 'De pie. Brazos relajados a los lados.',
    overlayHint: 'Alinea tu cuerpo con la silueta',
    rotationHint: null,
  },
  side_right: {
    title: 'Lateral derecho',
    instruction: 'Gira 90° a tu derecha.',
    overlayHint: 'Mantén la misma distancia',
    rotationHint: 'Gira 90° →',
  },
  side_left: {
    title: 'Lateral izquierdo',
    instruction: 'Gira 180° más para mostrar tu otro lado.',
    overlayHint: 'Casi terminamos',
    rotationHint: 'Gira 180° ↻',
  },
  back: {
    title: 'Espalda',
    instruction: 'Gira 90° más. Brazos relajados a los lados.',
    overlayHint: 'Misma distancia y altura',
    rotationHint: 'Última →',
  },
}
```

#### E.3 — Silhouette components

3 SVGs en `/features/onboarding/photos/components/`:

`SilhouetteFront.tsx` — figura de frente, viewBox `0 0 120 240`, paths como en mockup.

`SilhouetteSide.tsx` — perfil, viewBox `0 0 100 240`, paths como en mockup.

`SilhouetteBack.tsx` — espalda, mismo viewBox que front + línea dashed central.

`SilhouetteRenderer` decide cuál renderizar:

```tsx
function SilhouetteRenderer({ angle }: { angle: PhotoAngle }) {
  switch (angle) {
    case 'front':
      return <SilhouetteFront />
    case 'side_right':
      return <SilhouetteSide />
    case 'side_left':
      return (
        <View style={{ transform: [{ scaleX: -1 }] }}>
          <SilhouetteSide />
        </View>
      )
    case 'back':
      return <SilhouetteBack />
  }
}
```

Tamaño en pantalla: 110x220px (front/back), 90x220px (lateral). Stroke 1.5 con `rgba(255,255,255,0.6)`.

#### E.4 — CaptureButton

```tsx
function CaptureButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.captureBtn}>
      <View style={styles.captureInner} />
    </Pressable>
  )
}
```

Estilos:

- `captureBtn`: 56x56, borderRadius 50%, bg `pearlElevated`, border 3px `inkPrimary`, box-shadow ring blanco translúcido 4px alrededor
- `captureInner`: 42x42, borderRadius 50%, gradient `mauveLight → mauveDeep`

Spring scale 1 → 0.92 al press in, vuelve a 1 al press out.

#### E.5 — ThumbnailRow

```tsx
function ThumbnailRow({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.thumbnails}>
      {[1, 2, 3, 4].map((n) => {
        const state = n < currentStep ? 'done' : n === currentStep ? 'active' : 'pending'
        return <Thumbnail key={n} state={state} />
      })}
    </View>
  )
}
```

Estados:

- `done`: bg gradient `mauveLight → mauveDeep`, check ✓ blanco centrado
- `active`: bg `rgba(168,94,124,0.15)`, border 1.5px `mauveDeep`
- `pending`: bg `pearlMuted`, border 0.5px dashed `borderDashed`

Tamaño: 26x32px, borderRadius 5.

#### E.6 — useTakePhoto hook

`/features/onboarding/photos/hooks/useTakePhoto.ts`:

```ts
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from '@/lib/supabase'

export async function processAndUpload(uri: string, angle: PhotoAngle) {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('No auth')

  // 1. Resize + compress
  const processed = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1500 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  })

  // 2. Read as blob
  const response = await fetch(processed.uri)
  const blob = await response.blob()

  // 3. Path
  const timestamp = Date.now()
  const path = `${user.id}/${timestamp}_${angle}.jpg`

  // 4. Upload to storage
  const { error: uploadError } = await supabase.storage.from('progress-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })

  if (uploadError) throw uploadError

  // 5. Insert metadata row
  const { error: insertError } = await supabase.from('photos').insert({
    user_id: user.id,
    angle,
    storage_path: path,
    width: processed.width,
    height: processed.height,
    byte_size: blob.size,
  })

  if (insertError) throw insertError

  return { path, width: processed.width, height: processed.height }
}
```

#### E.7 — usePhotosToday hook

Para mostrar los thumbnails ya capturados en PhotoCaptureCard de Día 1:

```ts
export function usePhotosToday() {
  return useQuery({
    queryKey: ['photosToday'],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return []

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', user.id)
        .gte('taken_at', today.toISOString())
        .order('taken_at', { ascending: false })

      if (error) throw error

      // Generar signed URLs para cada
      const withUrls = await Promise.all(
        data.map(async (photo) => {
          const { data: urlData } = await supabase.storage
            .from('progress-photos')
            .createSignedUrl(photo.storage_path, 3600)
          return { ...photo, signed_url: urlData?.signedUrl }
        }),
      )

      return withUrls
    },
  })
}
```

#### E.8 — Pantalla photos done

`/app/onboarding/photos/done.tsx`:

```tsx
export default function PhotosDoneScreen() {
  const { data: photos = [] } = usePhotosToday()
  const router = useRouter()

  return (
    <View style={styles.container}>
      <LinearGradient colors={[pearlBase, pearlGradientEnd]} style={StyleSheet.absoluteFill} />
      <OrnamentShape variant="br" />

      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, checkAnimStyle]}>
          <Text style={styles.checkIcon}>✓</Text>
        </Animated.View>

        <Text style={styles.title}>
          Tu <Text style={styles.titleEmphasis}>antes</Text> queda guardado.
        </Text>
        <Text style={styles.sub}>En 30 días te avisamos para tomar las siguientes y comparar.</Text>

        <View style={styles.thumbsGrid}>
          {(['front', 'side_right', 'side_left', 'back'] as const).map((angle) => {
            const photo = photos.find((p) => p.angle === angle)
            return (
              <View key={angle} style={styles.thumb}>
                {photo?.signed_url && (
                  <Image source={{ uri: photo.signed_url }} style={StyleSheet.absoluteFill} />
                )}
                <Text style={styles.thumbLabel}>{ANGLE_LABELS[angle]}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <Pressable onPress={() => router.replace('/onboarding/day-one')} style={styles.ctaFull}>
        <Text style={styles.ctaLabel}>Volver a Día 1</Text>
      </Pressable>
    </View>
  )
}
```

Check con animación checkDraw (igual que Done pero más sutil — sin halo).

Grid 2x2 de thumbnails:

- aspect-ratio 3/4
- bg `inkPrimary` gradient
- borderRadius 8
- Image fill
- Label inferior absolute centered con bg semitransparente

---

### Bloque F — Home primera apertura

#### F.1 — Detección y routing

En `/app/_layout.tsx`:

```tsx
function RootRouter() {
  const { data: session, isLoading: sessionLoading } = useSession()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const visitedDayOne = useVisitedDayOne()

  if (sessionLoading || profileLoading || visitedDayOne === null) {
    return <SplashScreen />
  }

  if (!session?.user) return <Redirect href="/auth" />

  if (!profile?.onboarding_completed_at) {
    return <Redirect href="/onboarding/welcome" />
  }

  if (!visitedDayOne) {
    return <Redirect href="/onboarding/day-one" />
  }

  return <Slot />
}
```

#### F.2 — Estado isFirstDay en Home

En `/app/(tabs)/index.tsx`:

```ts
const { data: profile } = useProfile()
const { data: ctx } = useBriefContext()

const isFirstDay = !profile?.first_workout_at
```

`first_workout_at` es null si nunca se marcó workout. Trigger de A.1 lo setea automáticamente en el primer insert.

#### F.3 — TodayTile state "first-day"

En `/features/home/components/TodayTile.tsx`:

Extender estados:

```ts
type TodayTileState = 'morning' | 'day' | 'urgent' | 'completed' | 'first-day'
```

Render del state `first-day`:

- Top label: `Día 1 · ${dayOfWeek}`
- Bottom text: "Empieza tu racha"

Animación entrada:

```ts
if (state === 'first-day') {
  scale.value = withSequence(
    withTiming(0, { duration: 0 }),
    withTiming(1.2, { duration: 400, easing: Easing.bezierFn(0.34, 1.56, 0.64, 1) }),
    withSpring(1, { stiffness: 100, damping: 12 }),
  )
}
```

`bigPulse` continuo igual que otros estados.

#### F.4 — StreakCard state "first-day"

En `/features/home/components/StreakCard.tsx`:

Si `isFirstDay`:

- Background: gradient `[pearlElevated, '#FCF7F9']`
- Card label: "TU RACHA" en `mauveDeep` (en lugar de `inkPrimary`)
- Card soft: "Día 1" (en lugar de `${count} días seguidos`)
- Counter inferior: "0" en `mauveDeep`, "empezando" como label

Shimmer overlay:

```tsx
{
  isFirstDay && (
    <Animated.View style={[styles.shimmer, shimmerStyle]} pointerEvents="none">
      <LinearGradient
        colors={['transparent', 'rgba(168, 94, 124, 0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  )
}
```

Animación shimmer:

```ts
const translateX = useSharedValue(-1.5)
useEffect(() => {
  if (isFirstDay) {
    translateX.value = withRepeat(withTiming(1.5, { duration: 3000 }), -1, false)
  }
}, [isFirstDay])

const shimmerStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: `${translateX.value * 100}%` }],
}))
```

#### F.5 — Day1Banner

Component nuevo:

```tsx
function Day1Banner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.eyebrow}>Día 1</Text>
      <Text style={styles.text}>
        Tu primer cuadrito está esperando. Marca tu entreno cuando lo termines y la racha empieza.
      </Text>
    </View>
  )
}
```

Estilos:

- `banner`: bg `rgba(168, 94, 124, 0.08)`, borderRadius 14, padding 14px 16px, marginTop 12, textAlign center
- `eyebrow`: Inter UI 9px weight 600 letter-spacing 2 uppercase color `mauveDeep`
- `text`: Inter UI 12.5px line-height 1.5 color `inkPrimary`

#### F.6 — Esconder elementos en first day

En el Home:

```tsx
{isFirstDay ? (
  <>
    <Header />
    <StreakCard isFirstDay={true} ... />
    <Day1Banner />
  </>
) : (
  <>
    <Header />
    <StreakCard ... />
    <MacrosCard />
    <LogMealButton />
    <DeltaPair />
    <AnchorLine />
    <QuickActions />
    <MoodPicker />
  </>
)}
```

#### F.7 — Micro-celebración del primer workout

En el handler de `markWorkout`:

```ts
const handleMarkWorkout = async () => {
  await markWorkout() // mutation existente

  if (isFirstDay) {
    // Trigger celebración
    setShowCelebration(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setTimeout(() => setShowCelebration(false), 2000)
  }
}
```

Componente Celebration overlay:

```tsx
{
  showCelebration && (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.celebrationOverlay]}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(400)}
    >
      <View style={styles.celebrationContent}>
        <Animated.View entering={ZoomIn.springify()}>
          <Text style={styles.celebrationCheck}>✓</Text>
        </Animated.View>
        <Text style={styles.celebrationText}>Día 1</Text>
      </View>
    </Animated.View>
  )
}
```

Estilos:

- `celebrationOverlay`: bg `rgba(250, 250, 251, 0.95)`, justify-content center, align-items center
- `celebrationCheck`: 80px, color `mauveDeep`, font Inter Tight Light
- `celebrationText`: Inter Tight 32px Light color `inkPrimary` letter-spacing -1

---

### Bloque G — Reminder de fotos cada 30 días

#### G.1 — Hook useLatestPhotoSet

```ts
export function useLatestPhotoSet() {
  return useQuery({
    queryKey: ['latestPhotoSet'],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return null

      const { data, error } = await supabase
        .from('photos')
        .select('taken_at, angle')
        .eq('user_id', user.id)
        .order('taken_at', { ascending: false })
        .limit(20)

      if (error) throw error
      if (!data?.length) return null

      // Buscar el set más reciente con los 4 ángulos (con tolerancia 1h)
      const grouped = groupPhotosBySet(data, 60 * 60 * 1000) // 1h tolerance
      const completeSet = grouped.find((set) => {
        const angles = new Set(set.map((p) => p.angle))
        return (
          angles.has('front') &&
          angles.has('side_right') &&
          angles.has('side_left') &&
          angles.has('back')
        )
      })

      if (!completeSet) return null

      const latestDate = Math.max(...completeSet.map((p) => new Date(p.taken_at).getTime()))
      return new Date(latestDate)
    },
  })
}

function groupPhotosBySet(photos: Photo[], toleranceMs: number) {
  // Agrupa fotos cuyas timestamps estén dentro de la tolerancia
  const sorted = [...photos].sort(
    (a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime(),
  )
  const groups: Photo[][] = []
  for (const photo of sorted) {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup) {
      const lastTime = new Date(lastGroup[0].taken_at).getTime()
      const thisTime = new Date(photo.taken_at).getTime()
      if (Math.abs(lastTime - thisTime) <= toleranceMs) {
        lastGroup.push(photo)
        continue
      }
    }
    groups.push([photo])
  }
  return groups
}
```

#### G.2 — PhotoReminderBanner

```tsx
function PhotoReminderBanner({ daysAgo }: { daysAgo: number }) {
  const router = useRouter()

  return (
    <View style={styles.banner}>
      <View style={styles.textWrap}>
        <Text style={styles.eyebrow}>Han pasado {daysAgo} días</Text>
        <Text style={styles.text}>Captura tus fotos de hoy para ver el cambio.</Text>
      </View>
      <Pressable
        onPress={() => router.push('/onboarding/photos/front?source=reminder')}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Capturar →</Text>
      </Pressable>
    </View>
  )
}
```

Estilos:

- `banner`: gradient `mauveLight → mauveDeep`, borderRadius 14, padding 14, layout row
- `eyebrow`: white opacity 0.85, Inter UI 9px uppercase letter-spacing 1.6
- `text`: white, Inter UI 12.5px line-height 1.4
- `cta`: bg `pearlBase`, padding 8px 14px, borderRadius 100, color `mauveDeep`, Inter Medium 12px

#### G.3 — Renderizar banner en Home

```tsx
const { data: latestPhotoSet } = useLatestPhotoSet()
const daysSinceLastPhotos = useMemo(() => {
  if (!latestPhotoSet) return null
  const diff = Date.now() - latestPhotoSet.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}, [latestPhotoSet])

// En el render:
{
  !isFirstDay && daysSinceLastPhotos !== null && daysSinceLastPhotos >= 30 && (
    <PhotoReminderBanner daysAgo={daysSinceLastPhotos} />
  )
}
```

Posición: debajo del StreakCard, antes de MacrosCard.

#### G.4 — Source=reminder routing

En el wizard de fotos, leer query param `source`:

```ts
const { source } = useLocalSearchParams<{ source?: string }>()

// Al terminar el wizard:
if (source === 'reminder') {
  router.replace('/(tabs)/index')
} else {
  router.replace('/onboarding/day-one')
}
```

---

## Acceptance criteria

1. User nuevo después de auth llega a `/onboarding/welcome`
2. Las 8 pantallas del wizard funcionan en orden: welcome → name → DOB → sex → height → weight → goal → done
3. ProgressBar refleja el paso actual correctamente
4. Cada paso valida su input antes de habilitar "Continuar"
5. Botón "Atrás" en cada paso (excepto welcome y done) regresa al anterior preservando datos
6. El nombre se usa en eyebrows posteriores ("Sofía,") y en pantalla Done
7. Palabras destacadas en preguntas (llamas, naciste, biológico, mides, pesas, quieres lograr) se renderizan en mauveDeep weight 500
8. Al completar wizard, `profiles.onboarding_completed_at` se setea
9. El peso del user nuevo crea row en `body_measurements`
10. Done muestra check animado con halo + nombre destacado
11. Día 1 muestra perfil resumido + card de fotos destacada + 3 tasks
12. Card de fotos tiene shimmer animado mientras 0/4
13. Tap en CTA de fotos lanza el wizard fotográfico
14. Wizard de fotos: 4 pantallas en orden (front, side_right, side_left, back) con progress bar 4 segmentos
15. Cada pantalla muestra silueta SVG correcta superpuesta a la cámara
16. Lateral izquierdo es la silueta lateral con scaleX(-1)
17. Capture button: haptic + procesa + sube + navega al siguiente
18. Foto se comprime a max 1500px y jpg 80% antes de upload
19. Foto se sube a `progress-photos/{user_id}/{timestamp}_{angle}.jpg`
20. Foto se inserta en tabla `photos` con metadata
21. Skip muestra Alert con confirmación
22. Photo done: 4 thumbnails + título personalizado
23. Volver a Día 1 actualiza los slots con thumbnails capturados
24. CTA "Entrar a la app →" en Día 1: marca AsyncStorage `visited_day_one` y navega a Home
25. Home primera apertura: card con shimmer + tile gigante con animación germinate + counter "0 empezando" en malva + banner "Día 1"
26. Elementos NO relevantes en first day están escondidos (macros, deltas, ancla, etc.)
27. Marcar primer workout: trigger setea `first_workout_at`, `isFirstDay` cambia a false, Home se redibuja con todo
28. Micro-celebración al marcar primer workout (overlay "Día 1 ✓" 2s)
29. Photo reminder banner aparece después de 30 días de la última foto completa
30. RLS verificado: user B no puede ver fotos de user A
31. RLS verificado en bucket: user B no puede listar archivos del path de user A
32. `pnpm typecheck` y `pnpm lint` pasan
33. Cero hex inline en código nuevo — todo via tokens de `/theme`
34. Animaciones de transición entre pasos suaves (slide_from_right del Stack)

---

## Lo que NO se hace

- Photo gallery / vista de progreso histórico (post-MVP, en Sprint Progress 2.0)
- Comparativa side-by-side de fotos (post-MVP)
- Edición de foto después de tomada (re-tomar sí, editar no)
- Apple Sign In / Google Sign In en welcome (auth real, post-sprint)
- BMR/TDEE/calculadora automática (Sprint 4 con LLM)
- Restricciones alimentarias / lesiones (post-MVP)
- Foto de perfil del user (no relevante)
- Detectar primer campo null y saltar (sprint futuro)
- Notificaciones push de recordatorio (post-MVP — por ahora solo banner in-app)
- Auto-guardar copia de fotos en galería del user (privacy: NO por defecto)

---

## Notas para Claude Code

- **Profundidad antes que ancho.** Pulir cada pantalla del wizard antes de pasar a la siguiente. El detalle de las animaciones (entrance, halo, shimmer, germinate) es lo que hace la diferencia premium vs genérico.

- **Empezar por Bloque A y B.** Sin schema y componentes compartidos, todo se rompe.

- **Probar en simulator después de cada bloque.** Las animaciones se sienten distintas en device real vs Snack.

- **Para el wizard fotográfico, simulator no tiene cámara.** En desarrollo usar `expo-image-picker` como fallback. En device real usar `expo-camera` puro. Detectar con `Platform.isPad`/Constants.

- **Las siluetas SVG son críticas.** Si quedan torcidas o no comunican bien la pose, reescribir los paths. Test visual: poner la silueta encima de una foto real y ver si la persona puede alinearse.

- **Hapticos:**
  - `Selection` al cambiar selección en SelectableCard
  - `Light` al tap "Continuar"
  - `Medium` al capturar foto
  - `Medium` al completar wizard principal (Done)
  - `Success` al marcar primer workout (Home first day)

- **Edge cases que probar:**
  - User cierra app entre paso 4 y 5 → al reabrir, ¿qué pasa? (debe volver a welcome con datos pre-poblados — los inputs cargan de profile)
  - User intenta "Continuar" sin llenar campo → disabled
  - User pone nombre con solo espacios → trim debe vaciarlo
  - Edad menor a 13 → max date del picker bloquea
  - Peso 1000kg → validación 30-300kg bloquea
  - User niega permisos de cámara → mostrar estado con CTA a configuración
  - Upload de foto falla por red → reintentar 1 vez automático, mostrar error si falla 2da
  - User salta fotos en Día 1 → photo card sigue visible, slots vacíos
  - User cierra app durante upload → al regresar debe poder continuar

- **Privacidad: las fotos del cuerpo son ÍNTIMAS. Verificar:**
  - Bucket es privado (no public)
  - RLS en tabla photos funciona (probar con dev users B intentando leer A)
  - RLS en storage funciona (user B no lista archivos del path de A)
  - Signed URLs con TTL 1 hora, no URLs públicas
  - Foto se comprime antes de upload (no sube original 8MB)

- **Commits atómicos** por tarea: `feat: extend profiles schema with onboarding fields`, `feat: add wizard layout component`, etc.

- **Al cerrar sprint:** correr los 34 acceptance criteria uno por uno. Reportar cualquiera que no se cumpla. Especialmente verificar privacidad/RLS — si fallan ahí, no se puede shippear.

---

## Estimación de tiempo

- Bloque A (schema + setup): 0.5 días
- Bloque B (componentes compartidos): 1 día
- Bloque C (8 pantallas wizard): 2 días
- Bloque D (Día 1): 1 día
- Bloque E (photo wizard): 2-3 días (más complejo: cámara + upload + siluetas)
- Bloque F (Home first day): 1 día
- Bloque G (reminder 30 días): 0.5 días

**Total: 8-9 días efectivos.** A 2 tardes/semana = ~4 semanas.

Si necesitas reducir el sprint, las cosas más diferibles son:

- Bloque G (reminder) → puede ir post-MVP
- Bloque F.7 (micro-celebración del primer workout) → opcional, banner se queda
- Bloque B.2 (OrnamentShape con Reanimated) → puede ser estático sin animar

Lo no diferible: A, B (excepto B.2 animaciones), C, D, E completos.
