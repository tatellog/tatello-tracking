# Endurecimiento de privacidad · 28 sep 2026

Auditoría de la dueña contra una lista de riesgos legales comunes en apps
hechas rápido. Lo que se hizo y lo que falta.

## Hecho

- **Lectura de fotos solo de la dueña.** Migración
  `20260928120000_private_photo_reads.sql` (aplicada en prod el 28 sep):
  quita `meal_photos_public_read` y `avatars_public_read`, que dejaban a
  cualquiera listar las fotos de comida y avatares de todas las usuarias.
- **La app pide enlaces firmados** (`lib/storage/signed-url.ts`,
  `components/PrivateImage.tsx`) en vez de URLs públicas.
- **Edad mínima 18** en el onboarding (antes 13), igual que Términos y
  Privacidad.
- **Privacidad dice todo lo que se comparte:** Apple Salud (solo lectura),
  OpenAI para escaneos y para el chat de patrones, sin nombre ni correo.

## Paso 2 · pendiente (cerrar los buckets)

Hacerlo SOLO cuando el build con enlaces firmados esté instalado por las
usuarias beta. Antes, el build viejo (que usa URLs públicas) dejaría de ver
las fotos de comidas y avatares.

Crear la migración y pasarla por `rls-auditor`:

```sql
-- Revertir: update storage.buckets set public = true where id in ('meal-photos','avatars');
update storage.buckets set public = false where id in ('meal-photos', 'avatars');
```

## Sin acción (no aplica hoy)

- Fuentes: van empaquetadas en la app, no se piden a Google.
- Analítica: propia, solo eventos, sin grabación de sesión.
- Correos: solo los transaccionales de Supabase. Un correo de marketing
  futuro necesita enlace de baja y dirección postal.
- Pagos: no hay. Una suscripción futura debe mostrar precio y renovación
  junto al botón.
- Agente de copyright (DMCA): las fotos no se publican; opcional.
