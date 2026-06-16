# Jerarquía CTA vs Card · Spec

**Problema que resuelve:** en una UI dark y plana, una _card_ (contenedor) y un
_CTA_ (acción) pueden verse idénticas (`bgCard` + hairline + radius chico, sin
sombra). Si nada distingue lo tappable de lo decorativo, la usuaria no sabe qué
tocar. Esta spec fija el lenguaje visual para que **la forma codifique la
interactividad**.

---

## Regla madre — la forma dice si algo se toca

| Señal                                | Significado                       | Token                                   |
| ------------------------------------ | --------------------------------- | --------------------------------------- |
| **Pill** (radius 100)                | acción suelta (botón)             | `radius.pill`                           |
| **Rect redondeado** (4–16)           | superficie (card / contenedor)    | `radius.card` / `tile` / 16             |
| **Chevron `›`** al final de una fila | esa fila navega / abre algo       | `styles.chevron`                        |
| **Chevron-abajo `⌄`** (rota a `⌃`)   | la card expande detalle in-situ   | `›` rotado 90° (`expandGlyph`)          |
| **Relleno magenta + glow**           | la acción primaria de la pantalla | `colors.magenta` + `shadows.ctaMagenta` |

**Una card nunca es pill. Un botón suelto nunca es un rect tipo-card sin otra
señal.** Si algo es tappable, debe portar **al menos una** señal de la tabla.
Si no porta ninguna, se lee (y debe ser) un contenedor inerte.

### La gramática de 3 verbos (cards y superficies)

- `›` **navega** — te lleva a otra pantalla (chevron horizontal, al final de la
  fila/card). Ej: filas de Ajustes, `PatternCard` de Órbita.
- `⌄` **expande** — abre detalle _aquí mismo_ (chevron rotado a abajo; gira a
  `⌃` al abrir). Ej: las cards de "Tu universo hoy".
- sin glifo = **lee** — superficie inerte. Ej: "Esto construiste", "Voz de
  Stelar".

### Un canal por mensaje (cards interactivas con estado)

Cuando una card tiene a la vez **estado** (progreso/activa) y **affordance**
(se toca), cada mensaje va en su propio canal — si comparten canal, el usuario
lee el estado brillante como "esta es la especial" en vez de "estas se tocan":

| Mensaje                      | Canal                                                 |
| ---------------------------- | ----------------------------------------------------- |
| **Affordance** (¿se toca?)   | el glifo `⌄` — **idéntico en todas**, siempre visible |
| **Estado** (¿cuánto creció?) | el anillo / color / relleno propio de la card         |
| **Foco** (¿cuál abrí?)       | borde acento + el glifo rota a `⌃`                    |

La affordance es **aditiva** (la lleva quien la necesita), nunca sustractiva:
no se apagan las read-only, solo la señal vive en las tappables.

---

## Los niveles de acción

Viven en `components/PrimaryCta.tsx` (variantes `primary` / `soft` / `ghost` /
`destructive`, prop `pill`). **No hand-roll** un botón nuevo: usá `PrimaryCta`.

1. **Primario** — `variant="primary"`: relleno magenta + glow `ctaMagenta`.
   **Uno por pantalla** (foco único del manifiesto). Ej: _Entrar_, _Continuar_.
2. **Secundario** — `variant="soft"`: borde magenta 1.5 + label magenta, sin
   relleno sólido. Acción alterna que no compite con el primario.
3. **Fantasma** — `variant="ghost"` + `pill`: transparente + borde hairline +
   label leche. Bajo riesgo. Ej: _Cerrar sesión_, _Cancelar_.
4. **Destructivo** — `variant="destructive"` (o tint rojo + `radius.pill`):
   rojo apagado, subordinado al magenta. Ej: _Eliminar mi cuenta_.

Botones sueltos secundarios/fantasma van **pill** — así la forma sola ya los
separa de cualquier card.

---

## Filas tappables dentro de una card (navegación)

Cuando una card o fila abre/edita algo, lleva un **chevron `›`** alineado a la
derecha. El chevron es la señal universal de "esto navega". La card estática
**no** lo lleva.

Patrón canónico ya implementado: `PlanRow` / `AccountRow` / la card de perfil en
`app/(tabs)/settings.tsx`. Para filas nuevas, replicá ese patrón
(label + valor/tagline + `styles.chevron`, con `accessibilityElementsHidden` en
el chevron). El feedback de press es `opacity` (`rowPressed`), nunca un cambio
de color que lo haga parecer seleccionado.

---

## Excepciones (NO se les aplica pill/chevron)

- **Chips de selección** (agua, ciclo, segmentos): son toggles, no navegación
  ni acción suelta. Se distinguen por su **estado activo** (borde/tint magenta),
  no por forma. Su tappabilidad la da el contexto de lista de opciones.
- **Cards de selección del onboarding** (intención, ritmo): radio-cards; la
  señal es la selección (crossfade), no un chevron.
- **Botones de icono** (cerrar `✕`, cámara, +): el icono ya es la señal.

---

## Checklist al construir una pantalla

- [ ] ¿Hay **un solo** CTA primario (magenta lleno)?
- [ ] ¿Cada botón suelto secundario/fantasma es **pill**?
- [ ] ¿Cada fila/card tappable de navegación tiene **chevron**?
- [ ] ¿Las cards inertes **no** tienen pill, chevron, ni relleno de acción?
- [ ] ¿Usaste `PrimaryCta` en vez de hand-rollear un botón?

---

## Estado de adopción (jun 2026)

- ✅ `PrimaryCta` con 4 variantes + `pill` — botón canónico.
- ✅ Chevron-rows en Ajustes (`PlanRow`, `AccountRow`, card de perfil).
- ✅ Auth: `SubmitButton` es pill magenta; el botón deshabilitado lleva
  hairline para leerse como "pill esperando", no hueco muerto.
- ✅ Ajustes: _Cerrar sesión_ y _Eliminar cuenta_ pasaron a **pill** (antes
  _Cerrar sesión_ era `bgCard` + hairline → idéntico a una card).
- ⚠️ Pendiente de revisar caso por caso: `scan-meal` `addBtn` (outline + icono,
  borderline), y cualquier botón nuevo que no pase por `PrimaryCta`.
