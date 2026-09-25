# 🌌 Roadmap STELAR

## El modelo: un sistema, no muchas features

STELAR no es una colección de features sueltas. Es **un motor alimentado
por tubos de entrada**:

```
   ENTRADAS                EL MOTOR              LA EXPERIENCIA
 (cómo entra el dato)   (qué le da sentido)    (lo que ve el user)
 ───────────────────   ───────────────────    ───────────────────
 · Registro manual                             · Tu Cielo
 · Escaneo IA (foto)  ──►  Motor de        ──►  · Voz del coach
 · Escaneo IA (texto)      órbitas              · Ciclos
 · Sync wearables          (conoce tus          · Figura zodiacal
                            patrones)
```

Los tubos de entrada son intercambiables. El motor es uno solo. La
experiencia es una sola. No son tres productos — es un producto y
varios tubos para alimentarlo.

**Dos cosas que colapsan la complejidad:**

- **Foto y texto son la misma feature.** Una sola Edge Function
  `scan-meal`: imagen → Claude visión, texto → Claude texto, misma
  salida. La DB ya lo anticipó — `meals.source` acepta `'manual' |
'photo_ai' | 'text_ai'`.
- **El sync de wearables es solo otro tubo** que escribe en las mismas
  tablas de órbitas; el motor nunca sabe de dónde vino el dato.

---

## Las 3 fases

Cada fase funciona sin la siguiente. La app ya es valiosa con solo
registro manual + órbitas. El escaneo IA y los wearables son
_aceleradores_ de entrada, no requisitos.

### ✅ Fase A — La columna vertebral

_Buildable sin gastar un peso. Estado: casi completa._

- [x] Timezone por usuario (`profiles.timezone` + `user_tz()`)
- [x] Tablas de órbitas (`sleep_logs`, `cycle_events`, `wellbeing_checkins`)
- [x] Vista unificada `daily_signals`
- [x] Datos dummy para desarrollo (usuario `seed@stelar.test`)
- [ ] **Motor de órbitas** — Claude lee `daily_signals` y narra patrones

> El motor necesita una API key de Anthropic.

### ⬜ Fase B — Acelerador de entrada

_Buildable ya (necesita API key de Anthropic)._

- [ ] Escaneo IA: **foto + texto** — una sola Edge Function `scan-meal`
- [ ] Control de costo (cuota por usuario, validada server-side)

### 🔒 Fase C — Cobro + wearables

_Bloqueada por una sola cosa: cuenta de Apple Developer ($99/año) +
build nativo (no Expo Go). Cobro y wearables se desbloquean juntos._

- [ ] Cobro: RevenueCat + In-App Purchases (modelo freemium)
- [ ] Apple Health (HealthKit) — integración del lado del dispositivo
- [ ] Garmin — integración del lado de la nube (OAuth + webhooks)
- [ ] Android: Health Connect (equivalente a HealthKit)

---

## Modelo de negocio

El escaneo de comida es commodity — todas las apps lo tienen. El
diferenciador de STELAR es el **significado**: convertir identidad en
sistema, detectar las órbitas de energía de la persona. El paywall
gatea el _entendimiento_, no la utilidad.

| Gratis (el anzuelo)             | Premium (el universo)               |
| ------------------------------- | ----------------------------------- |
| Registro manual, escaneo básico | Lectura de tus órbitas              |
| Tu día de hoy                   | Tu Cielo completo en el tiempo      |
| Onboarding astrológico          | Narrativa de patrones del coach     |
|                                 | Historia de ciclos · sync wearables |

---

## Arquitectura — principios

- **Ningún cliente llama a una API de IA directo.** Todo escaneo IA
  pasa por una Edge Function de Supabase que guarda la API key como
  secreto del servidor y controla la cuota.
- **El motor de órbitas lee `daily_signals`**, la superficie que
  unifica todas las señales por `(usuario, día local)`.
- **Wearables**: Apple Health se lee en el dispositivo y se sube;
  Garmin empuja datos a la Edge Function por webhooks.
- Las tablas de órbitas guardan timestamps crudos + fecha local que
  pasa el cliente — sin columnas de fecha generadas que horneen una
  zona horaria.
