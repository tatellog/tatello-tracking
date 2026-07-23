# Beta build · comandos exactos

Distribución manual para la cohorte de 3 + tú. No hay CI todavía;
estos comandos los corres tú desde tu máquina.

## ⚠️ Antes de pensar en iOS

EAS Build a iOS (TestFlight o ad-hoc) **requiere una cuenta Apple
Developer paga ($99 USD/año)**. Según las notas del proyecto no
tienes una. Hasta que adquieras la membresía y vincules el Apple
Team a EAS, **iOS queda bloqueado**. Android no tiene este
requisito — funciona inmediato.

---

## Pre-vuelo (cada build)

```sh
pnpm typecheck            # debe pasar limpio
pnpm test                 # debe pasar limpio
pnpm check:rls            # 16/16 tablas con RLS + policies
```

Si vas a empujar una versión nueva a las usuarias, **bump
`expo.version`** en `app.json` antes del build (semver). EAS lleva
el build number automáticamente vía `autoIncrement` para production
y los preview builds toman uno fresco cada vez.

## EAS CLI

Una sola vez:

```sh
pnpm dlx eas-cli login
eas whoami                # confirma tu usuario de Expo
```

El `projectId` ya está en `app.json` (`a44e4351-…`) — no hay que
linkear de nuevo.

---

## Android · APK distribuible

```sh
eas build --platform android --profile preview
```

Esto produce un `.apk` (no `.aab`) gracias a `distribution:
"internal"` en `eas.json`. Tarda ~10-15 min en la cola gratuita.

**Distribución:**

1. Cuando termine el build, EAS te da una URL del dashboard donde
   descargar el `.apk`.
2. Comparte el link (o sube a Google Drive y comparte el link
   privado) a tus 3 usuarias.
3. En Android: tienen que **activar "instalar apps de fuentes
   desconocidas"** la primera vez (Ajustes del teléfono → Apps →
   acceso especial → instalar apps desconocidas → tu navegador o
   Drive).
4. Al actualizar a una versión nueva, descargan el nuevo `.apk` y
   se instala encima — los datos persisten.

---

## iOS · TestFlight (REQUIERE Apple Developer paga)

```sh
eas build --platform ios --profile preview
eas submit --platform ios --latest
```

El `--latest` toma el build más reciente del perfil `preview` y lo
sube a App Store Connect. EAS pregunta credenciales la primera vez
(Apple ID + app-specific password o Expo guarda las creds).

**Configurar TestFlight (en App Store Connect):**

1. Abre [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   → Stelar → **TestFlight**.
2. Espera a que el procesamiento del build termine (~10-30 min
   tras `eas submit`).
3. **Internal Testing** → "+" → crea grupo "Beta" → agrega las 3
   usuarias por su **Apple ID** (su email de iCloud).
4. Tras agregarlas, Apple les manda un email con instrucciones para
   instalar TestFlight + acceder a Stelar.
5. Apple **NO necesita revisar** builds para Internal Testing —
   están disponibles inmediato. (External Testing sí pasa por
   revisión.)

**Actualizar la beta:** repite los dos comandos (`build` + `submit`).
TestFlight notifica a las testers automáticamente cuando un nuevo
build está disponible.

---

## Después del build

Ya con usuarias usando la app:

```sh
pnpm report:beta        # retención + comidas + último abrir
pnpm report:feedback    # buzón de comentarios que enviaron
```

**Activar el flag `is_beta`** (sin esto la app NO trackea ni muestra
el botón de feedback): en Supabase Studio → table editor →
`profiles` → para cada uno de los 4 user_ids:

```sql
UPDATE profiles SET is_beta = true WHERE id = '<user-uuid>';
```

---

## Profiles de `eas.json`

Solo usamos `preview` para la beta. Los otros perfiles existen para
otros flujos (development client, simulator, production con auto-
increment). **No los toques** para la beta.

| Perfil      | Distribución | Para qué                              |
| ----------- | ------------ | ------------------------------------- |
| `preview`   | internal     | Beta APK/IPA — lo que corres acá      |
| development | internal     | Dev client en dispositivo físico      |
| simulator   | internal     | iOS simulator builds                  |
| production  | (store)      | App Store / Play Store (más adelante) |
