# ADR 0001 · Intelligence Engine — dónde corre, cómo lo lee el cliente

**Estado:** Aceptado (jul 2026, aprobado por la dueña) · **Epic:** 01 · F0 · T0.2
**Supersede:** nada · **Relacionado:** `docs/epics/epic-01-intelligence-engine.md`,
`docs/architecture/{architecture,backend,frontend,ai-philosophy}.md`

## Contexto

R1 formaliza un motor que **ya funciona** pero está fusionado client-side
(`features/orbit/findings.ts`) + un motor divergente (`month-built.ts`) + el
contexto compartido (`_shared/intelligence/`). Restricciones duras:

- **Estamos en producción con usuarias reales.** Cualquier cambio debe ser
  aditivo, con RLS, y NO puede romper la app que ya corre.
- Existe el patrón puente `_shared/intelligence/` ↔ cliente (misma lógica en
  Metro y Deno) y un tripwire de "hash dorado" que vigila que server y cliente
  produzcan lo mismo.
- El modelo de dominio ya se centralizó (T0.1 → `_shared/intelligence/engine.ts`).

La pregunta: **¿dónde corre cada engine, dónde se persiste, y cómo lo lee el
cliente sin romper nada?**

## Decisión

1. **La lógica del motor son FUNCIONES PURAS en `_shared/intelligence/`** (corren
   en Metro y en Deno). Los tipos de dominio viven en `engine.ts` (hecho en T0.1).
   Nada de RN, Supabase-client ni globals de Deno en esa carpeta.

2. **Persistencia por un WRITER backend.** Un edge function / RPC computa y
   escribe `facts / findings / stories / hypothesis / monthly_reports` (tablas
   nuevas, **aditivas**, con RLS `auth.uid() = user_id`). El _trigger_ del writer
   (agendado vs on-write vs on-read-miss) se decide en F1.

3. **El cliente LEE de las tablas persistidas** vía `api.ts` (Zod) + `hooks.ts`
   (React Query), **con FALLBACK a compute client-side** durante la transición.
   Así nadie se queda sin datos si el writer aún no corrió.

4. **Flip del origen detrás de un FLAG por superficie.** El cambio de
   "computar en cliente" → "leer de tabla" se activa por feature-flag, superficie
   por superficie, y SOLO tras probar **paridad** (golden-hash / snapshot). Hasta
   entonces, nada visible cambia.

5. **`hashFindings` (la llave del caché de la voz de IA) se mueve a `_shared`**
   cuando el motor converja, para tener UN solo cálculo (evitar el problema
   cliente-vs-server del hash dorado).

6. **`conversation_cache` se difiere:** se mantiene `ai_insights` (ya funciona,
   sin cambio de schema). Se re-evalúa si aparece una razón fuerte.

7. **Pureza de `_shared/intelligence/*` se hace cumplir.** Hoy por disciplina +
   comentario de cabecera; se agrega un check de CI/lint en F2 (review #15) que
   verifique que no importe RN/Supabase-client/Deno.

## Consecuencias

**Positivas:** motor reusable (server + cliente), migración sin romper la app en
vivo, testeable (paridad antes del flip), base persistente para R3/R5/R6.

**Negativas / costo:** durante la transición hay **dos caminos de lectura**
(tabla + fallback compute) = complejidad temporal que hay que retirar al cerrar
cada flip. El writer añade una historia de scheduling (definir en F1).

## Alternativas consideradas

- **Seguir 100% client-side** (como hoy). Rechazada: sin persistencia no hay base
  para R3/R5/R6 ni reuso server-side; el motor seguiría duplicado/divergente.
- **Mover todo al backend y hacer flip directo.** Rechazada: rompe la app en vivo
  y no hay red de paridad; con usuarias reales es inaceptable.

## Preguntas abiertas (se resuelven en F1)

- Trigger del writer: agendado (cron), on-write (al registrar), o on-read-miss.
- Retención/recomputo de `facts` (¿se recalcula el mes en curso cada día?).
