# Epic 07 · Longitudinal Intelligence

**Status:** Draft · **Priority:** P3 · **NO construir aún** — documentar hoy para
no refactorizar mañana · **Depende de:** 01–06 con sus modelos de datos listos

---

## Por qué se documenta ya (sin construirse)

Después de 6–12 meses de uso, Stelar conecta **múltiples meses** para responder
cosas que ninguna app de tracking hace bien:

- "Hace tres meses este patrón aparecía cada semana y ahora casi desapareció."
- "La última vez que ocurrió algo similar fue en febrero."
- "Desde que sincronizaste tu Garmin, tu sueño dejó de ser el principal factor
  asociado a tus días fuera de déficit."

No es necesaria para el MVP de Progress, pero es de las funciones **más difíciles
de copiar** y de las que más fidelidad generan a largo plazo. Documentarla ahora
obliga a que las épicas 01–06 dejen los **modelos de datos y la arquitectura**
preparados para soportarla **sin refactors**.

## Qué debe quedar preparado desde 01–06 (requisitos hacia atrás)

- **Snapshots inmutables y con fecha** de insights/hitos: los `ProgressInsight`
  y los hitos que importan deben poder **archivarse** (como los patrones de
  Órbita en `revelations`, con números congelados). Un insight que se evapora de
  la ventana no debe perderse — Epic 07 necesita la serie histórica.
- **Reflexiones persistidas con timestamp** (Epic 05, `month_reflections`): la
  memoria de lo que el usuario notó/esperaba, para comparar meses.
- **Fuente de datos por-mes estable**: agregados mensuales reproducibles (no solo
  la ventana rodante), para poder mirar "hace 3 meses".
- **Marcas de eventos externos** (p. ej. "conectó Garmin el 2 mar") para poder
  decir "desde que…".

## Alcance (cuando se construya)

- Motor longitudinal que compara **N meses** (no la ventana rodante): aparición/
  desaparición de patrones, recurrencias, cambio de factor dominante.
- Conexión con la **memoria de patrones de Órbita** (`revelations` tier='pattern')
  y con las reflexiones — Progress aporta el "qué cambió" a lo largo del tiempo,
  Órbita el "qué lo acompañó".
- Alma Celeste / Evolución Celeste como su expresión visual de largo plazo.

## IA

Cuando exista: **solo conecta y explica** los hechos longitudinales que el motor
ya calculó. Nunca detecta la tendencia por sí sola. Éxito = entender mejor, no
chatear más.

## Guardarraíles

- Inmutabilidad: la historia longitudinal **no recalcula** el pasado.
- Sin culpa ni comparación con otras personas; solo el usuario vs su propio
  pasado.
- Sin predecir ni diagnosticar (línea roja del manifiesto).

## Definition of Done

N/A (no se construye aún). El "done" de esta épica hoy es que **01–06 respeten
sus requisitos hacia atrás**: snapshots inmutables con fecha, reflexiones con
timestamp, agregados mensuales reproducibles, marcas de eventos externos.
