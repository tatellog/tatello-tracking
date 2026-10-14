# STELAR — MASTER PRODUCT & IMPLEMENTATION PLAN

**Version:** 1.0  
**Date:** 2026-10-13  
**Status:** Working product specification / durable handoff for Claude  
**Primary audience:** Product, Design, Frontend, Backend, QA, AI-assisted engineering

> **Claude: read this file at the start of every implementation session.** Treat the product principles as constraints; treat the proposed UI and backlog as hypotheses to validate against the actual repository. Update the execution ledger at the end of each session. Do not rewrite the vision to fit a convenient implementation.

---

## 0. READ THIS FIRST — NON-NEGOTIABLE PRODUCT CONTRACT

### What Stelar is

Stelar is an app for **sustainable weight loss through evidence-based self-understanding**. It tracks food, calories, macros, deficit and weight accurately, then uses the person's own longitudinal data to identify patterns associated with difficulties sustaining consistency.

**Core promise:** _“Que entiendas tu cuerpo, no solo que registres lo que haces.”_  
**Economic loop:** _“Registrar es el costo; entender es la recompensa.”_  
**Product loop:** Input → validated daily signals → deterministic facts/findings/story/ranking/hypothesis → understandable discovery → reflection → meaningful reason to continue input.

Examples of problems Stelar seeks to help users understand: weekday/weekend disruptions, disengagement around week three, one difficult day turning into several days of abandonment. Stelar identifies repeated associations with evidence and invites reflection; it **does not assert causal explanations** without proof.

### What Stelar is NOT

- Not a diet-plan generator, personal trainer, clinical service or diagnostic app.
- Not a generic AI coach that prescribes “eat less”, “sleep more”, training plans or interventions.
- Not a gamified streak-pressure product; no guilt, punitive copy or moral labeling of days/food.
- Not an astrology engine. Zodiac constellations are a meaningful visual metaphor for earned knowledge milestones, not predictions.
- Not a dashboard that merely recreates Apple Health or smartwatch charts.
- Not an excuse to produce invented insights when there is insufficient evidence.

### Immutable product rules

1. **Data or silence.** No generated personal discovery unless the deterministic engine actually supports it.
2. **Deterministic engine detects; AI only explains.** GPT-4o-mini must never invent patterns, calculate hidden findings or turn general research into personal results. Use ✦ only for actual AI-supported interactions.
3. **Weight is measured, not protagonized.** Do not put numeric weight, weight goal percentage or weigh-in nags in Home or notifications. Progress views may show factual weight history with context.
4. **Wearables are ingest-only.** Apple Health/Garmin may supply signals, but do not use wearable TDEE as ground truth and do not “eat back” exercise calories.
5. **Respect partially logged days.** Missing food ≠ no food; partial logs cannot support confidently asserted deficits or intake comparisons.
6. **Evidence and uncertainty are visible.** Distinguish fact, early observation, repeated pattern, hypothesis and general education.
7. **User agency.** Offer questions and reflection, not judgment or commands. Feedback does not turn a subjective opinion into statistical evidence.
8. **Existing architecture first.** Inspect working code, flags and data contracts before proposing new engines, tables, endpoints or designs.
9. **Accessibility, privacy and trust** are release gates, not optional polish.
10. **Do not silently change thresholds** for insight qualification, data completeness or TDEE confidence; document, test and review any adjustments.

---

## 1. VERIFIED CONTEXT VS. ASSUMPTIONS

### Context supplied by product owner

- Inputs: food (photo/text AI extraction), weight/scale, workouts, sleep, water, cycle; Apple Health/Garmin wearable ingestion.
- Persistence: Supabase Postgres with strict RLS; raw data tables aggregated into `daily_signals` view per user/day.
- Deterministic intelligence: `_shared/intelligence`, pipeline `facts → findings → story → ranking → hypothesis`.
- Monthly engines: `month-built` (evidence including deficit/calendar/actionable patterns), `month.ts` (narrative), `month-patterns` (cadence habits); adaptive TDEE with declared quality.
- GPT-4o-mini explains; it is not the discovery engine. Guided chat / voice of the day consume validated findings.
- Weekly Reading is deterministic: revelations, milestones and constellations. Acquired knowledge milestones do not disappear just because subsequent weight fluctuates.
- Tabs: **HOY** (“¿qué hice?”), **COMIDAS** (“¿qué consumí?”), **DESCUBRE** (“¿qué significa?” with Day/Week/Month and recommended FOCO), **PROGRESO** (“¿qué cambió?” with trends, body and constellations).
- Product stages: Phase 1 instant return from registration is built; Phase 2 Weekly Reading is built but dev-gated; Phase 3 input integrity in progress (honest food search, nutrition-label photo, partial-day model). Much intelligence exists behind flags.
- Intended discovery milestones: first real reflection <48h; first pattern <14 days; quality-declared adaptive TDEE <28 days (targets to test, not promises to every user).

### Observations from the 2026-10-13 walkthrough recording

- Home features vivid orbital/constellation animation, daily rings, food shortcuts, macro cards and short daily text. Visual importance falls heavily on tracking.
- A photo/text food flow requires identifying a meal, reviewing extracted ingredient/quantity and confirming. One demonstration is tuna in water; AI extraction and editable quantity are visible.
- Progress shows monthly registered days, training, deficit and weight-history/detail cards.
- Discovery/consistency areas show wearable-adjacent context (sleep/workout), a textual note about short sleep and intake, calendar bubbles, quick log and day details.
- Settings show notification timing/preferences, data controls and logout/delete paths.
- Some screens use generic-seeming insights and metrics side by side; the distinctive, evidence-backed finding is not always visually differentiated from tracking data.

**Important limits:** a screen recording cannot establish which underlying algorithms are correct, which flags are enabled in production, actual user retention, or whether the app's findings meet statistical standards. Verify repository and instrumentation. Do not claim hidden features are absent simply because they did not appear in the video.

### Open technical facts to verify in repository

- Actual screen/component names and routing hierarchy.
- Feature flag identifiers and prerequisites for Phase 2 / hidden intelligence.
- Whether `daily_signals` encodes partial/incomplete days today; unknown vs zero semantics.
- Exact insight schema, engine thresholds, test fixtures, ranking/deduplication behavior.
- Available privacy controls and telemetry framework.
- Food image / label review flow, source attribution and confidence.
- Existing quality classifications for adaptive TDEE and whether UI uses correct labels.

---

## 2. PRODUCT OUTCOME & MEASUREMENT

### North-star candidate

**Weekly Meaningful Discoveries Rate (WMDR)** = eligible weekly users who viewed >=1 evidence-backed personal discovery and explicitly marked it useful or meaningfully engaged with its reflection / eligible weekly users. Avoid treating click or impression alone as understanding. Segment by availability/quality of data.

### Funnel instrumentation

1. `insight_eligible` — deterministic, persisted or reproducible finding meets policy and quality bar.
2. `insight_presented` — user had a real chance to perceive its UI (not just fetched).
3. `insight_opened` — detail/evidence deliberately opened.
4. `insight_feedback_submitted` — useful / not useful / does not match my experience / unsure.
5. `insight_followup_viewed` — later reflection or changes to evidence reviewed.
6. `user_return_after_gap` — returned after X inactive days and completed an optional useful action.

Log only IDs, non-sensitive aggregate metadata and consented analytics. Avoid raw food/weight/health data in general-purpose logs. Define event ownership, retention and deletion; respect opt-out.

### Supporting KPIs

- Time to First Reflection (target <48h among data-eligible users; honest fallback otherwise).
- Time to First Qualified Pattern (target <14d among eligible users; report sample sufficiency).
- Time to First Quality-Declared Adaptive TDEE (target <28d among eligible users, never guaranteed).
- % findings useful; % dismissed/duplicative; qualified findings presented per eligible week.
- D7/D30 retention, segmented by users with/without first qualified finding.
- Median time to log a repeat meal, photo extraction correction rate, incomplete-day rate.
- Return-after-gap recovery success; false-positive/unsafe insight rate; data sync coverage.

**Anti-metrics:** number of generated insights alone, pure screen time, streak length, food logs/day, AI chat messages. These can be diagnostics but not success criteria.

---

## 3. TARGET JOURNEYS

### A. New user: 0–48 hours

1. Simple goal framing: sustainable weight loss; honest explanation that repeated patterns need time.
2. Permission choices; avoid blocking on wearable connection.
3. First meaningful logging with immediate truthful reflection. If evidence limited, display a useful factual recap/question, **not** a “discovered pattern”.
4. Preview what will become possible when enough comparable data exists; avoid rigid progress countdowns that invite fabricated insights.
5. Make any follow-up discovery optional and easy to access.

### B. Routine week

1. Home shows the most relevant eligible personal discovery/observation **if there is one**; otherwise preserves delightful hero and useful tracking context.
2. Meals capture is swift and explicit about confidence/completeness.
3. Discover houses evidence, interpretation and hypothesis separately, with Day/Week/Month preserved.
4. Progress shows change over time, including knowledge milestones, without turning weight into a punitive score.

### C. Friday/weekend pattern (illustrative only)

- The engine detects a repeated time-window association **only on sufficient comparable logged days**.
- Interface: “En los últimos 3 viernes con registro suficiente, tu horario de última comida fue distinto al resto de la semana.”
- Evidence: actual dates/sample sizes, data completeness, comparison, caveats.
- Reflection: “¿Qué suele cambiar los viernes?”
- Feedback: useful / not representative / not sure.
- Never assert “los viernes te saboteas” or causal claims.

### D. Return after 6 days away

- No broken streak or mandatory backfill. “Podemos retomar desde hoy.”
- Use synced signals only with clear provenance. Allow optional revisit/mark days incomplete.
- Fast path back into a useful action or discovery; never imply missing meals mean fasting.

---

## 4. TAB-BY-TAB IMPLEMENTATION

### 4.1 HOY — “¿Qué hice?” / first glimpse of meaning

**Current friction:** visually strong orbital hero, metrics and food CTAs are salient; differentiated discovery is harder to identify at first glance.

**Product job:** answer “¿hay algo real que Stelar aprendió de mí?” without losing access to everyday logging.

**Changes (in order):**

- **H-01 [P0]** Add a single _featured evidence-backed discovery_ slot or an honestly named early observation, sourced from ranked eligible engine output. Do not generate on client from raw metrics.
- **H-02 [P0]** Explicit empty state when no qualified finding exists: ambient hero + one useful factual summary or neutral explanation of what makes patterns possible. No fabricated promise/date.
- **H-03 [P0]** Show data/insight type (“observación inicial”, “patrón detectado”, “pregunta para reflexionar”) and source/time freshness where relevant; AI ✦ only if actual AI explanation invoked.
- **H-04 [P1]** CTA opens _exact same finding ID_ in Descubre detail, preserving context and evidence; event tracking `insight_presented/opened`.
- **H-05 [P1]** Keep quick food registration prominent but secondary to a real finding; preserve familiar animation with reduced-motion support, fast load and no intrusive replay.
- **H-06 [P1]** Returning-user treatment: no guilt or backlog, optional recovery path.

**Acceptance criteria:**

- Qualified insight matches server/engine ID, ranking and quality classification; no UI invented pattern.
- Home never states confirmed deficit for an incompletely logged day.
- Exactly one featured personal discovery max; fallback when none; unchanged metrics accessible.
- CTA routes to evidence detail for same ID; tracking respects consent.
- Loading, offline, partial sync, errors, reduced motion and empty states pass QA.

**Don't:** replace Home with workouts/diet prescriptions; show weight number/goals; give every generic tip the same highlight as a true discovery.

### 4.2 COMIDAS — “¿Qué consumí?” / lower the cost

**Current friction:** photo/text and editable nutrient review work, but repeat use still has capture/review steps; trust requires transparent estimates.

**Changes:**

- **C-01 [P0, already Phase 3]** Honest search: match quality and serving source, no silent wrong food substitutions; allow “not found / manually enter”.
- **C-02 [P0, already Phase 3]** Photo nutrition label: distinguish label read vs inferred ingredient; show extracted fields with edit/confirm, units and servings.
- **C-03 [P0, already Phase 3]** Partial-day logging model: logged / partial / unknown; never confuse missing with zero; propagate to daily_signals and deficit eligibility.
- **C-04 [P1]** Recent/repeat meals and one-tap reuse with simple quantity/date correction; reuse source and data quality labels.
- **C-05 [P1]** After saving, show a small _factual_ immediate payoff: “Guardado; tu registro de hoy ahora incluye…”; a reflection only if evidence supports it.
- **C-06 [P1]** Users can easily fix AI errors without losing other confirmed ingredients; do not show unreviewed photo estimates as verified nutrition.

**Acceptance criteria:**

- Search surfaces source/confidence distinctions and never auto-selects unverified close matches silently.
- Label parsing handles serving size, per-100g/per-serving, units, multiple servings, missing fields.
- Partial-day status correctly flows to daily_signals, dependent engine gates and historical corrections.
- Editing a meal recomputes dependent aggregates; stale insights are invalidated/re-reviewed as necessary.
- Regression suite covers 0 vs null, timezone/day boundary, duplicate imports, corrected serving and photo failure.

**Don't:** inflate friction with mandatory confirmations for repeat trusted meals; treat calories/macros as moral scores.

### 4.3 DESCUBRE — “¿Qué significa?” / core product and likely premium engine

**Current friction:** personal discoveries, observations and broad informational copy may look equally important; evidence and novelty need stronger distinction.

**Changes:**

- **D-01 [P0]** Inspect facts/findings/story/ranking/hypothesis contracts and introduce/verify a UI-ready finding model: `id`, `type`, `scope`, `title`, `evidence`, `sample`, `quality`, `completeness`, `generated_at`, `status`, `ranking_reason`, `hypothesis`; preserve existing fields where adequate.
- **D-02 [P0]** Type-specific treatment: FACT / EARLY OBSERVATION / QUALIFIED PATTERN / HYPOTHESIS / GENERAL EDUCATION. General education is never marketed as “tu patrón”.
- **D-03 [P0]** One detailed evidence view with compared dates, sample size, source, relevant qualifiers and “qué sabemos / qué no sabemos”.
- **D-04 [P1]** Preserve Day/Week/Month; add a top-level distinction for New / Under observation / Previously learned (could be filters/sections, not necessarily new tabs).
- **D-05 [P1]** Short feedback after reading: useful / doesn't match / unsure; optional free-text context stored separately from engine proof.
- **D-06 [P1]** Ranking and deduplication: do not resurface the same substantive finding as “new” just because copy changes; promote updates with materially changed evidence.
- **D-07 [P1]** Recommended FOCO must link to one verifiable longitudinal pattern and reflect possible leverage, not prescribe behavior.
- **D-08 [P2]** GPT-4o-mini explanation gated behind a genuine AI action, grounded in structured evidence, with hallucination/causality checks and safe fallbacks.

**Acceptance criteria:**

- Every personal discovery has traceable deterministic evidence; unqualified claims never enter the personal feed.
- Copy differentiates correlation from cause; sample size and missingness are discoverable.
- AI cannot add new dates, thresholds, correlations or conclusions not supplied by engine.
- Feedback does not mutate deterministic evidence; persisted per-user with RLS.
- Same ID and status propagate Home, Discover and weekly reading; no contradictory labels.
- Empty states explain that no qualified new insight exists, without fabricating one.

**Don't:** build a generalized LLM pattern detector; guarantee a discovery every week; hide key qualifications behind dense legal copy.

### 4.4 PROGRESO — “¿Qué cambió?” / proof over time

**Current friction:** weight, deficit, training, registered days and calendar display alongside each other; interpretation remains fragmented.

**Changes:**

- **P-01 [P0]** Audit semantics: explicitly differentiate logged days, qualifying deficit days, workout days and unknown/partial days; verify denominators and language.
- **P-02 [P1]** Consolidate “what changed” above metric fragments: an evidence-led monthly/weekly narrative assembled from existing deterministic engines.
- **P-03 [P1]** Un-gate Weekly Reading in a limited beta **only after** integrity prerequisites, test evidence and copy review pass.
- **P-04 [P1]** Constellations encode verified knowledge milestones and reflective achievements, **not weight fluctuations or streak pressure**. A milestone can remain acquired while a previously inferred pattern is explicitly revised or invalidated.
- **P-05 [P1]** Keep weight history in detailed progress, not Home; avoid single-day weight interpretation and false causal links to cycle/water.
- **P-06 [P2]** Adaptive TDEE: show estimate, time coverage, quality class and limits only where the existing model marks it sufficiently supported; otherwise avoid a definitive number.

**Acceptance criteria:**

- Monthly summary never divides by all calendar days when metric eligibility requires fully logged days.
- No deficits claimed where intake completeness fails qualification.
- Weekly Reading is deterministic and consistent with Descubre details.
- Constellation milestones survive weight changes but are not used to keep discredited findings presented as true.
- Weight display is sensitive, non-judgmental and accessible; no Home weight leakage.

**Don't:** replace constellations with a generic weight graph; label estimated TDEE “real” without uncertainty.

### 4.5 TRANSVERSAL: CONSTANCIA / QUICK LOG / SETTINGS / NOTIFICATIONS

**Changes:**

- **X-01 [P0]** Audit current “constancia” vocabulary: eliminate implied guilt, incomplete-day misclassification and deficit badge ambiguity. Keep calendar informative rather than streak-punitive.
- **X-02 [P0]** Insight consistency across timezones, late wearable syncing, backfills and user edits; define staleness/invalidation.
- **X-03 [P1]** Resume after gap: no nag or mandatory backfill, no loss of previous knowledge milestones.
- **X-04 [P1]** Notifications only for truly new qualified discoveries or user-chosen reading reminders; not weigh-in demands or guilt. Rate-limit, respect quiet windows/consent.
- **X-05 [P1]** Settings: data permissions, sources, AI use, analytics opt-out, delete/export flows, accessible explanations of evidence provenance.
- **X-06 [P1]** Common evidence badges, feedback controls, skeleton/empty/offline states, accessible motion and contrast standards across surfaces.
- **X-07 [P2]** Safe deep links from notification → same insight ID → details; resolve invalidated insights gracefully.

**Acceptance criteria:** data provenance and sync times, timezone correctness, no direct personal insight based on missing data, no unauthorized cross-user access (RLS), no sensitive analytic payload, no unwanted notification after opt-out.

---

## 5. IMPLEMENTATION ORDER, DEPENDENCIES & RELEASE GATES

### Track A — Integrity FIRST (Phase 3, current)

1. Repo audit + map raw inputs, `daily_signals`, insight eligibility and flags.
2. Honest food search, label-photo parsing, partial-day data model and propagation.
3. Backfill/migration strategy and tests for pre-existing incomplete logs.
4. Reliability checks: duplicate wearable imports, timezones, reprocessing/invalidation.

**Gate A:** can reliably tell valid vs partial vs unknown; all downstream eligible metrics honor it.

### Track B — Make discovery visible (in parallel only after reading data contracts)

5. Evidence/insight types and shared DTO without duplicating the engine.
6. Discover detail with proof and uncertainty.
7. Home “featured discovery” with honest no-finding fallback and navigation.
8. Insight funnel analytics (consented) and dedupe.

**Gate B:** personal discovery has deterministic trace, no hallucinated claims and user sees its relevance within one tap.

### Track C — Weekly value / retention

9. Beta-enable prebuilt Weekly Reading with flag, audit tests and feedback.
10. Progress narrative/constellation semantics and calendar audits.
11. Resume-after-gap copy/flow and useful/no-useful insight feedback.

**Gate C:** during beta users can describe at least one non-generic thing Stelar helped them understand; no material false-positive findings.

### Track D — Monetization validation (NOT code-first paywall)

12. Qualitative tests 15–20 early users over 4 weeks; stratify by sufficient vs insufficient logs.
13. Test whether premium longitudinal comparisons, discovery history and guided evidence explanation produce actual willingness to pay.
14. Only then finalize free/premium boundary, pricing and billing scope.

**Gate D:** credible user-reported value + retention improvement + paid demand. Do not charge per number of generated insights.

### Proposed sprint structure (relative, re-estimate after repo audit)

- Sprint 0 (2–3 days): code/flag/schema audit, baseline, issues and dependencies.
- Sprint 1: input integrity, regression tests, provenance.
- Sprint 2: Discover evidence detail and taxonomy; Home surfaced insight.
- Sprint 3: Weekly Reading beta + Progreso narrative + feedback/return flow.
- Sprint 4: field validation, analytics review, QA hardening, prioritized iteration.

Actual duration depends on repo state; never assert these as approved commitments.

---

## 6. DEFINITION OF DONE / QUALITY CHECKLIST

For every ticket:

- Maps to a user problem and to lower registration cost or increase understanding reward.
- Reuses or documents changes to existing data contracts; no redundant engine/UI logic.
- Covers valid, missing, partial, corrected, duplicate, stale and out-of-order data.
- Uses deterministic evidence and declared quality; AI explains only the evidence.
- Adds tests at correct layer (engine unit, SQL/RLS, API, component, end-to-end as relevant).
- Preserves accessibility, reduced motion, screen reader labeling, contrast, error/empty states.
- Adds privacy-safe instrumentation and checks analytics consent.
- Provides screenshots or short walkthrough showing impact on affected tab.
- Updates feature flag and rollout instructions.
- Updates **Section 10 Execution Ledger** and **Section 11 Decisions** of this document.

### Key end-to-end test scenarios

1. New user has no entries: not a single made-up insight.
2. 2 days of entries: truthful reflection, not qualified repeated pattern.
3. 3 Fridays with sufficient records vs incomplete Fridays: compare correctly / otherwise no qualified claim.
4. Monday backfill changes Friday intake: invalidate or recompute dependent insight and UI cache.
5. Duplicate Apple Health workout and cross-midnight sleep: no double counting/wrong day.
6. Partial food day: no confirmed calorie deficit or TDEE confidence inflation.
7. User removes permission or deletes account: no stale privileged insight access.
8. Existing weekly milestone remains as a historical milestone while a finding is revised.
9. No qualified finding this week: quiet truthful UI, not filler insight.
10. Returning after 6 idle days: no guilt/backfill mandate; previously earned milestones preserved.
11. AI explanation challenged with unavailable facts: constrained to supplied evidence.
12. Reduced motion and dynamic text size: usable hero, insight and registration.

---

## 7. UX CONTENT & VISUAL SYSTEM RULES

Voice: curious, respectful, calm, specific, non-patronizing. Avoid shame, fake certainty and empty affirmations.

**Preferred:** “En 3 viernes con registros suficientes, cambió el horario de tu última comida. ¿Te suena familiar?”

**Avoid:** “Los viernes saboteas tu progreso.” / “Stelar sabe por qué fallas.” / “Debes comer menos.” / “Ya descubrimos tu metabolismo real.”

Label categories consistently:

- `Dato registrado` (verified entry or source-specific measurement)
- `Observación inicial` (limited sample)
- `Patrón detectado` (passes minimum eligibility and evidence)
- `Hipótesis para explorar` (interpretation, never presented as cause)
- `Información general` (not personalized)

Display sample n, valid days vs calendar days and source wherever useful. Avoid an arbitrary star/sparkle symbol for deterministic insights if ✦ identifies actual AI interaction. Cosmic/constellation motifs are visual metaphor only, not a truth signal or statistical significance badge.

---

## 8. FIRST 10 TICKETS (CLAUDE SHOULD VERIFY BEFORE IMPLEMENTING)

| ID     | Priority | Tab               | Deliverable                                                 | Dependency         |
| ------ | -------- | ----------------- | ----------------------------------------------------------- | ------------------ |
| ST-001 | P0       | Cross             | Repo/feature flag/engine/data contract inventory            | None               |
| ST-002 | P0       | Comidas           | Audit and finish partial-day status with regression         | ST-001             |
| ST-003 | P0       | Comidas           | Honest food search + sources and fallback                   | ST-001             |
| ST-004 | P0       | Comidas           | Label-photo extraction + verified editing                   | ST-001             |
| ST-005 | P0       | Cross             | Evidence and eligibility contract + correction invalidation | ST-001/002         |
| ST-006 | P0       | Descubre          | Evidence detail, labels, sources and sample                 | ST-005             |
| ST-007 | P0       | Hoy               | Feature ranked qualified discovery + honest empty state     | ST-005/006         |
| ST-008 | P0       | Cross             | Insight funnel events + consent + deduplication             | ST-005/007         |
| ST-009 | P1       | Progreso          | Audit deficit/calendar denominators and partial days        | ST-002/005         |
| ST-010 | P1       | Progreso/Descubre | Weekly Reading controlled beta readiness + QA               | ST-002/005/006/009 |

More tickets follow in the ledger as discoveries arise. Keep scope small: one verifiable user-facing outcome per PR.

---

## 9. CLAUDE OPERATING INSTRUCTIONS / SESSION PROMPT

Copy/paste the following into a Claude coding session:

> You are working on Stelar. First read `STELAR_MASTER_PLAN.md` in full. Stelar is a sustainable weight-loss self-understanding product, NOT a diet/training prescription coach. The deterministic intelligence engine finds patterns and AI only explains. Respect ingest-only wearables, partial-day eligibility, non-punitive UX, and the rule “data or silence.”
>
> Before coding, inspect the real repository: tabs/routes/components, Supabase schemas and RLS, `daily_signals`, `_shared/intelligence`, month engines, adaptive TDEE, tests and feature flags. Provide a short **AS-IS vs TO-BE** matrix for the relevant tab and identify existing implementations that can be reused. Do not rebuild what exists. Treat the product owner's descriptions as goals and the current repo as source of code truth. Raise contradictions before changing contracts.
>
> Choose the highest-priority unblocked ticket in Section 8 / execution ledger. State affected files, planned tests, migrations, flag effects and acceptance criteria. Implement the smallest change, test it, and report evidence (test outputs, screenshots or reproduction steps). Do not enable major flags without the stated gates. Update Sections 10 and 11 with completed work, remaining risk, exact files/PRs, and next ticket. If you cannot modify this document, provide an exact paste-ready update. Never mark a ticket complete without verification.

### Prompt for tab-by-tab work

> Focus only on **[TAB NAME]** and the related IDs in Section 4. Show existing flows and contracts, a precise UX issue list, proposed smallest changes, AC, test cases, and dependencies. Preserve product invariants and existing screens where possible. Implement P0 before P1. Avoid scope creep into unrelated tabs; cross-tab DTO changes require explicit notes.

### Context recovery prompt after conversation truncation

> Read `STELAR_MASTER_PLAN.md`, especially Sections 0, 1, 4, 5, 10 and 11. Also read current git status, last merged PRs and relevant test results. Summarize: (1) confirmed current architecture; (2) done/blocked/next items; (3) decisions not to revisit; (4) current failing tests and risks; (5) one next actionable ticket. Then continue without re-proposing a generic AI coach, new diet plans or replacing constellations with weight charts.

---

## 10. EXECUTION LEDGER — UPDATE AFTER EVERY SESSION

**Snapshot date:** 2026-10-13
**Repo commit (base):** `6c9add8` (main) · trabajo en rama `master-plan-integrity` (sin commit, pendiente de aprobación de la dueña)
**Current mainline branch:** `main`
**Feature flags (lib/featureFlags.ts, inventario ST-001):**

| Flag                                | Valor                              | Gate extra                     | Qué controla                                      |
| ----------------------------------- | ---------------------------------- | ------------------------------ | ------------------------------------------------- |
| `AI_MASTER_ENABLED`                 | true                               | —                              | Kill-switch global de IA                          |
| `aiEnabledForEmail`                 | dev@local.test, tatellog@gmail.com | —                              | Toda superficie IA (Mes IA, voz, chat)            |
| `USE_PERSISTED_MONTH_REPORT`        | true                               | solo MonthSegmentIA (dev)      | Lee `monthly_reports` del edge `compute-findings` |
| `MILESTONES_ENABLED`                | false                              | —                              | Persistir hitos en `revelations` tier='milestone' |
| `WEARABLE_BODY_COMPOSITION_ENABLED` | false                              | —                              | Permiso HealthKit de composición                  |
| `PATTERN_MEMORY_ENABLED`            | true                               | writer devOnly                 | Archivar patrones en `revelations` tier='pattern' |
| `PROGRESS_BODY_ENABLED`             | true                               | —                              | Progreso › Cuerpo                                 |
| `PROGRESS_CHAT_ENABLED`             | true                               | aiEnabledForEmail              | Chat de Progreso                                  |
| `WEARABLE_MOCK_DATA`                | true                               | aiEnabledForEmail              | Datos de ejemplo de composición                   |
| `WEEKLY_READING_ENABLED`            | true                               | aiEnabledForEmail (superficie) | Lectura Semanal (edge `weekly-reading`)           |
| `HERO_ALIVE_ENABLED`                | true                               | reduce-motion                  | Hero vivo de Hoy                                  |
| `ORBITA_SINGLE_FEED`                | true                               | —                              | Descubre de un solo scroll (sin Día/Semana/Mes)   |
| `weekdayPlanEnabledForEmail`        | dev + dueña                        | —                              | Plan de un día                                    |

**Known live:** Fase 1 (microlectura post-registro `features/macros/micro-reading.ts`, tarjeta "Tu día" `features/tabs/tu-dia.ts`).
**Built/dev-gated:** Fase 2 Lectura Semanal; Órbita Mes IA + chat; memoria de patrones; R1 persistido.
**In progress:** Fase 3 integridad (ST-002 en curso; ST-008 arrancado 14 oct 2026).
**Next unblocked:** ST-008 (eventos del recorrido de un hallazgo + consentimiento + dedupe).

| Ticket | Status                                                                                                                                                                                                          | Commit/PR                    | Verified evidence                                                                                                                                    | Owner/notes                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ST-001 | **Completed**                                                                                                                                                                                                   | rama `master-plan-integrity` | Inventario abajo (§10.1)                                                                                                                             | Auditoría solo lectura, con refs a archivos                                                                 |
| ST-002 | **In Progress** (código completo; `stelar-insight` desplegada 13 oct 2026; falta validación en device del micro-reading)                                                                                        | rama `master-plan-integrity` | jest 1304/1304, tsc 0, eslint 0; tests de piso/hoy fallan contra el código anterior; `deficit.test.ts`; promedio solo completos en `context.test.ts` | P11 decidido (se queda); P12 decidido (a) e implementado                                                    |
| ST-003 | Partial (verificado)                                                                                                                                                                                            | —                            | Placeholder 8 g/150 kcal eliminado; `source` por ingrediente; SIN tabla de lookup; "Buscar" = solo historial propio (top 24 de 90 d)                 | Lookup = decisión dueña: tabla propia al FINAL de Fase 3                                                    |
| ST-004 | Built, not validated                                                                                                                                                                                            | —                            | Modo etiqueta end-to-end (chips, edge `mode:'etiqueta'`, per-100, confianza); sin tests; deploy de edge + validación con etiquetas reales pendientes | Ver hallazgos §10.1                                                                                         |
| ST-005 | **In Progress** (cortes 1-4: bug `payload`, etiqueta y muestra en patrones/combo/sorpresa, invalidación al corregir; falta validar en Android y los huecos dev → ST-011)                                        | rama `master-plan-integrity` | `prior-findings.test.ts`, `evidence-label.test.ts` (10); validado en simulador iOS                                                                   | Falta: combo dominante y sorpresa con el mismo contrato; `generated_at`/estado; invalidación por corrección |
| ST-006 | **In Progress** **Built** (cortes 1-5: "lo que todavía no sabemos", fuente, barra en 0, detalle de sorpresa estilo Fitness, corte de pasos exacto, combo; falta validación visual del combo)                    | —                            | `EvidenceModal` (MonthSegment.tsx) muestra barras, fechas y "why"; sin n ni calidad                                                                  | —                                                                                                           |
| ST-007 | **Built** (cortes 1-3: destacado en Hoy = protagonista de Descubre, solo mientras es nuevo, como fila corta sin números; en `main` 14 oct 2026; falta verificar el toque y eventos H-04 en ST-008)              | `main`                       | Hoy no tiene slot de descubrimiento; el buzón `requestOrbitEvidence(patternId)` existe pero solo lo usa push                                         | Depende de ST-005/006                                                                                       |
| ST-008 | **In Progress** (cortes 1-2: eligible/presented/opened con finding id, interruptor en Ajustes, "¿Esto coincide con tus días?"; migración en prod 14 oct 2026; falta validación visual y de eventos)             | rama `master-plan-integrity` | `track()` → `analytics_events` (solo `is_beta`); eventos `insight_shown/opened` para lecturas; sin finding id; SIN consentimiento/opt-out            | —                                                                                                           |
| ST-009 | **In Progress** (corte 1: hoy abierto fuera del déficit, denominadores desde que empezaste, comparación por proporción, proteína de días completos; quedan H5-H9 de baja)                                       | rama `master-plan-integrity` | Ver denominadores en §10.1                                                                                                                           | Depende de ST-002                                                                                           |
| ST-010 | **In Progress** (corte 1: motor con reglas de integridad, N8 sin ✦ y sin cancelarse el lunes, se congela al tocarla, fila en Descubre; falta deploy de edge, validación en dev build y abrir el gate a la beta) | rama `master-plan-integrity` | —                                                                                                                                                    | No confundir construido con lanzado                                                                         |

### 10.1 ST-001 · Inventario (2026-10-13)

**Rutas de tabs** (`app/(tabs)/`): `index.tsx` (Hoy), `meals.tsx` (Comidas → `features/tabs/components/MealComposer.tsx`), `orbit.tsx` (Descubre; con `ORBITA_SINGLE_FEED` = `DayPresent` compacto + `MonthSegment view="patterns"`), `progress.tsx` (Progreso), `settings.tsx`, `movement-calendar.tsx` (Tu constancia).

**Motor** (`supabase/functions/_shared/intelligence/`, re-exportado en `features/orbit/`):

- R1 `engine.ts`/`findings.ts`/`stories.ts`/`hypothesis.ts`: `Finding` con `id` estable por detector, `category`, `confidence` 0-100, `emerging`, `evidenceDates`. Le falta `n` explícito, calidad/completitud, `generated_at`, estado/retracción. Solo `Hypothesis` tiene ciclo de vida. Persistido por edge `compute-findings` (upsert, nunca borra) y solo lo lee `MonthSegmentIA` (dev).
- La beta ve OTRO motor, efímero en cliente: `month-built.ts` + `surprise.ts` + `maturity.ts` (etapas por días con datos; `deficitReady` ≥8 días completos). `MonthPattern` no trae confianza ni n.
- Umbrales vigentes (NO cambiar sin decisión): findings.ts (weekday-calories ≥10 filas, ≥3 por día, Δ≥200; rescue ≥12 días, ≥4 por lado; diet-break ≥12…), surprise.ts `MIN_SIDE=3`, `SURPRISE_MIN_SCORE=0.12`, month-built `PATTERN_MIN_DAYS=8`, `COMBO_MIN_OCCUR=3`, weekly-reading `WEEKLY_READING_MIN_DAYS=3`.
- Ya existe distinción temprana/calificada parcial: `emerging` ("Señal naciente"), "Primera señal" en etapa <3, `finding-arc.ts` (Observado → Encontrado → En seguimiento → Confirmado). Falta la taxonomía única de §7.

**Día parcial:** definición única `day-quality.ts` (completo ≥800 kcal / parcial / vacío) — la usan adaptive-tdee, combo-facts, surprise, maturity, weekly-reading. Déficit sano `deficit.ts` `isDeficitDay` = [0.6×meta, meta]. Decisiones dueña 23 jul: parcial dentro del piso SÍ cuenta como déficit; TDEE excluye parciales; promedio kcal de la Lectura Semanal incluye parciales.

**`daily_signals`** (última def. `20260925065841_wearable_weight_signals.sql`): sin comidas → `calories`/`meal_count` NULL (no 0). Días agrupados con la zona horaria ACTUAL del perfil (cambiarla re-agrupa la historia). Cliente: sin Zod en `features/orbit/api.ts` (conserva null); Hoy (`features/brief/api.ts` `TodayMacrosSchema`) usa `z.coerce.number()` → null se vuelve 0.

**Hallazgos de integridad (bugs/inconsistencias, priorizados):**

1. ✅ (ST-002 c1) Hoy decía "Vas en déficit." y la microlectura "X kcal por debajo" con cualquier ingesta ≤ meta, sin piso del 60% (un desayuno de 150 kcal = "déficit"). Igual Descubre Día ("En déficit").
2. ✅ (ST-002 c2) Calendario del mes pintaba HOY abierto debajo del piso como "comiste poco" y lo metía al denominador; Semana decía "N días terminaron en déficit" contando hoy.
3. ⏳ Promedios que mezclan parciales: `context.ts` `avgCal`, `month-built.ts` `avgDeficitKcal`/`avgOnDeficitDays`; `weekly-reading.ts` `kcalAvg` (este último = decisión dueña, se queda).
4. ⏳ Un día PASADO a medio registrar (<60%) se marca "comiste poco" en el calendario: mezcla registro incompleto con ingesta baja. Requiere decisión de producto (ver §12).
5. ⏳ `stelar-insight/index.ts:51` copia `isDeficitDay` en línea (puede divergir); arreglarlo implica deploy de edge.
6. ⏳ `features/orbit/api.ts:80` `countSignalDays` cuenta filas de la vista (que puede abrir varias por día) → "días en órbita" inflado.
7. ⏳ `MonthSegment.tsx:559-573` `deficitTrendUp` compara ventana rodante 31 d contra mes calendario anterior.
8. ✅ (ST-005 c1) `report-hooks.ts` `.select('report')` vs columna `payload` → corregido; parser puro en `features/orbit/prior-findings.ts`.
9. ⏳ Comidas: `createMeal` fija `meals.source='manual'` siempre (`features/macros/api.ts:293`); `'base'` nunca se asigna; "Buscar" comenta "todo el historial" pero solo cubre top 24; la nota de duda de etiqueta dice "Leímos tu plato…"; "Registrar tal cual" aparece en etiquetas de alta confianza; azúcar faltante en etiqueta → 0 en silencio, proteína/kcal faltante → 502.
10. ⏳ Sin tests de: 0 vs null con `meal_count>0`, borde de medianoche/zona horaria, recalcular tras editar comida, flujo de etiqueta, `getFrequentMeals`.

**Analítica / consentimiento:** `lib/analytics.ts` `track()` → `analytics_events`, solo usuarias `is_beta`, fire-and-forget. No hay opt-out. Eventos de insight existentes: `insight_shown` / `insight_opened` (micro_reading, early_reading, weekly_reading, day_reading, meal_reveal), `orbit_viewed`. Sin evento de evidencia abierta ni finding id.

**Feedback:** no existe "útil / no útil". Lo más cercano: `month_reflections` ("¿Esto ya lo sabías?"), `scan_feedback`, `beta_feedback`.

### Session log

### 2026-10-13 — ST-001 + ST-002 (cortes 1 y 2) — rama `master-plan-integrity` (sin commit)

- **As-is evidence:** ver §10.1 hallazgos 1 y 2. `tu-dia.ts` usaba `dayReading` (`status:'deficit'` si consumido ≤ meta, sin piso); `micro-reading.ts` igual; `day-readings.ts` "En déficit" con kcal>0 y ≤ meta; `monthCalendar` clasificaba hoy como `'low'`; `confirmedFacts` contaba hoy en "terminaron".
- **Changed files:**
  - `features/tabs/tu-dia.ts` — "Vas en déficit." solo si `isDeficitDay`; debajo del piso → `status:'open'`, "Tu día sigue abierto." (misma copy que ya existía para sobre-meta).
  - `features/macros/micro-reading.ts` — margen de déficit solo dentro de la banda; si no, silencio.
  - `supabase/functions/_shared/intelligence/day-readings.ts` — chip "En déficit" solo dentro de la banda; debajo, sin chip y voz "Tu día sigue abierto."
  - `supabase/functions/_shared/intelligence/month-built.ts` — `monthCalendar` acepta `openDay` (el hoy REAL, aparte del ancla `YYYY-MM-31` de meses pasados): hoy debajo del piso → neutro y fuera de `dataDays`. Opcional y retrocompatible.
  - Llamadores pasan `openDay`: `features/orbit/components/MonthSegment.tsx`, `MonthSegmentIA.tsx`, `features/progress/components/MovementCalendarPanel.tsx`, `TrainingShareCTA.tsx`.
  - `features/orbit/week-orbit-logic.ts` — "terminaron en déficit" excluye hoy.
  - Tests: `features/tabs/__tests__/tu-dia.test.ts`, `features/macros/__tests__/micro-reading.test.ts`, `features/orbit/__tests__/day-readings.test.ts`, `features/orbit/__tests__/month-built.test.ts`, `features/orbit/__tests__/week-sections.test.ts`.
  - Migraciones: ninguna. Flags: ninguno. Deploy: ninguno (`day-readings` solo se re-exporta en `_shared/intelligence/index.ts`; ninguna edge lo consume).
- **UX before → after:** 10 am con un desayuno de 150 kcal → antes "Vas en déficit." en Hoy, "Tu día va 1,313 kcal por debajo de tu meta." tras guardar, "En déficit" en Descubre Día y "comiste poco" en el calendario → ahora "Tu día sigue abierto.", silencio en la microlectura, sin chip y sin marca en el calendario hasta que el día entre en la banda o cierre.
- **Automated tests:** `npx jest` 105 suites / 1293 tests ✓ (base 1281; +12 nuevos). Los nuevos de piso/hoy fallan contra el código anterior (4 + 2) → detectan el bug. `npx tsc --noEmit` ✓. `eslint` en archivos tocados ✓.
- **Manual cases/screenshots:** NO hechos en device en esta sesión (pendiente: Hoy a media mañana con 1 comida; calendario del mes).
- **Known risks:** el día de cierre (20:00) mantiene la regla vigente (parcial dentro del piso = déficit, decisión dueña). Un día de HOY dentro de la banda se sigue pintando dorado en vivo (puede pasar a superávit más tarde), consistente con Día y con el cierre.
- **Decisions logged:** §11 fila 2026-10-13 "Déficit solo dentro de la banda sana en toda superficie de hoy".
- **Next recommended ticket:** ST-002 corte 3 (promedios con parciales en `context.ts`/`month-built.ts` + tests 0 vs null y medianoche) y después ST-005 (arreglar `payload` + contrato de evidencia). Hallazgo 4 necesita decisión de la dueña antes de tocarse.

### 2026-10-13 — Fix visual (fuera de ticket, pedido por la dueña) — rama `master-plan-integrity`

- **As-is:** el texto de la celebración "Entrenaste hoy · Una luz más en tu Escorpio." (`RingCelebration`) estaba anclado a `bottom: 64` y caía encima de la barra de tabs flotante, mezclado con sus íconos (captura de la dueña en iPhone 15 Pro Max).
- **Cambio:** `features/tabs/components/RingCelebration.tsx` ancla el texto justo bajo el anillo del emblema (1.18 × radio) con tope sobre la barra; `features/tabs/components/AppTabBar.tsx` exporta `TAB_BAR_HEIGHT_ABOVE_INSET` (alto real de la barra sobre el safe-area).
- **Tests:** tsc ✓, eslint ✓. **Validado por la dueña (13 oct 2026): la celebración ya se ve bien** (iOS). Android pendiente.

### 2026-10-13 — ST-002 corte 3 + ST-005 corte 1 — rama `master-plan-integrity` (sin commit)

- **ST-002 c3 (solo tests, sin cambio de comportamiento):** `features/orbit/__tests__/deficit.test.ts` — la regla `isDeficitDay` no tenía test propio: banda, piso, null/0/undefined (faltar ≠ ayunar), meta inválida; y comidas sin calorías (`meal_count>0`, `calories` null) no se pintan "poco" ni entran al denominador, ni Hoy afirma déficit. Zona horaria/medianoche ya cubiertas en `lib/__tests__/time.test.ts`.
- **ST-002 NO tocado a propósito (decisión de producto):** `context.ts` `avgCalories` (→ hecho `avg_calories` persistido por `compute-findings` y contexto de la IA) promedia días parciales. Excluirlos cambia una métrica persistida y contradice el precedente de la Lectura Semanal (la dueña dejó parciales con copy declarado). `month-built.ts` `avgDeficitKcal` también mezcla parciales pero NO se muestra en ninguna superficie (campo muerto). Ver §12 P12.
- **ST-005 c1:** `features/orbit/report-hooks.ts` lee `payload` (columna real) en vez de `report`; el parser vive puro en `features/orbit/prior-findings.ts` (testeable sin cliente Supabase). Efecto: el estado "Confirmado" del arco de evidencia (`finding-arc.ts`) puede encenderse por recurrencia en Órbita Mes IA (solo cuentas dev; la beta no lo ve).
- **Tests:** jest 107 suites / 1302 ✓, tsc ✓, eslint ✓. Sin migraciones, flags ni deploys.
- **Manual:** simulador iOS (iPhone 15 Pro Max, Expo Go) arranca con los cambios; "Tu constancia" de la cuenta dev muestra 1 y 6 oct como "poco" (días pasados <60%, P11) y hoy sin marca. La cuenta dev no tenía comida hoy: el caso "Tu día sigue abierto." queda por verse en device.
- **Next recommended ticket:** ST-005 corte 2 (contrato de evidencia para `MonthPattern`/surprise: `n`, días válidos vs calendario y etiqueta §7, reutilizando `emerging`/`maturity`/`finding-arc`), luego ST-006.

### 2026-10-13 — ST-002 corte 4 (decisiones P11/P12) — rama `master-plan-integrity`

- **P11:** sin cambios (la dueña lo deja así).
- **P12-a:** `supabase/functions/_shared/intelligence/context.ts` (`avgCalories` solo de días `completo`, nuevo `completeDays`), `facts.ts` (`avg_calories` con evidenceCount = días completos), copia inline en `supabase/functions/stelar-insight/index.ts` (mismo umbral 800 y mismo campo). Hash dorado re-pineado en `features/orbit/__tests__/ai-prompt.test.ts` (`ae7268c8`); tests nuevos en `context.test.ts`.
- **Tests:** jest 107 suites / 1304 ✓, tsc ✓, eslint ✓.
- **Riesgo / pendiente:** `stelar-insight` debe desplegarse (`supabase functions deploy stelar-insight`) o el `context_hash` del server diverge del cliente (la caché de IA no acierta hasta el deploy; solo afecta cuentas con IA = dev). `avgProtein` sigue promediando parciales (no fue parte de la decisión).
- **Next recommended ticket:** ST-005 corte 2.

### 2026-10-13 — ST-002 corte 5 (hallado en la validación visual) — rama `master-plan-integrity`

- **As-is:** en el simulador (cuenta dev, 250/1,585 kcal a las 16:55) Descubre decía "Sigues en déficit" con anillo magenta: `features/orbit/day-verdict.ts` afirmaba déficit de día con cualquier consumo ≤ meta (había un test que lo fijaba con 360 kcal).
- **Cambio:** de día, "Sigues en déficit" solo dentro de la banda sana; debajo del piso → "Tu día sigue abierto" / "El cierre llega esta noche.", anillo neutro (`ringTone: 'incomplete'`, el arco de calorías no se dibuja; la cifra sigue en la leyenda). Test actualizado + caso nuevo en `day-verdict.test.ts`.
- **Validación visual (iOS, Expo Go, iPhone 15 Pro Max):** Hoy "Tu día sigue abierto." ✓ · Descubre "Tu día sigue abierto" ✓ · Tu constancia: el 13 sin "poco" y fuera de "2 registrados" ✓. Comida de prueba insertada por SQL en la cuenta dev (`notes = 'claude-st002-preview'`) con autorización de la dueña; la dueña decidió DEJARLA (13 oct 2026).
- **Tests:** jest 107 / 1305 ✓, tsc ✓, eslint ✓.
- **Deploy (autorizado por la dueña, 13 oct 2026):** `supabase functions deploy stelar-insight` desde `master-plan-integrity`. Antes del deploy la versión remota (v21) era idéntica a `main`, así que solo entra el cambio P12-a. Smoke: OPTIONS 200 (arranca, sin BOOT_ERROR).

### 2026-10-13 — ST-005 corte 2 (contrato de evidencia de los patrones del mes) — rama `master-plan-integrity`

- **As-is:** las tarjetas de patrón de Descubre (`PatternFindingCard`, "También encontré", modal de evidencia) no decían qué tipo de afirmación eran ni sobre cuántos días se apoyaban; el eyebrow era decorativo ("Un patrón de tu mes", solo en la primera).
- **Cambio:**
  - `supabase/functions/_shared/intelligence/evidence-label.ts` (nuevo, puro; re-export en `features/orbit/evidence-label.ts`): `EvidenceLabel` (dato / observacion / patron / hipotesis / general) con el texto del §7, `monthPatternLabel(p, maturityStage)` y `patternSampleLine(sample)`.
  - `month-built.ts`: `MonthPattern.sample` (grupos comparados + días) declarado en los 6 detectores `kind: 'pattern'` con los MISMOS conteos con los que deciden (test: coinciden con los denominadores de las barras).
  - `features/orbit/components/MonthSegment.tsx`: eyebrow = etiqueta ("Patrón detectado" / "Observación inicial"), línea de muestra bajo la frase ("11 días comparados · Con entreno 8 · Sin entreno 3"), y ambas en el modal de evidencia (también al abrirlo desde el push N9, mismo id).
- **Sin umbrales nuevos:** "inicial" vs "detectado" reutiliza el corte de madurez que la UI ya usaba para "Empieza a asomar" (`maturity.stage <= 2`).
- **P13 resuelta (dueña, 13 oct 2026): mínimo 5 días por grupo.** `monthPatternLabel` exige madurez (etapa > 2) Y `PATTERN_MIN_DAYS_PER_GROUP = 5` en CADA grupo de `sample`; si no, "Observación inicial". Sin muestra declarada nunca es "detectado". Las guardas del detector (≥3 por lado) siguen decidiendo si el patrón aparece; el mínimo solo gobierna la etiqueta. Efecto en la cuenta dev: la tarjeta "Con entreno 8 · Sin entreno 3" pasa a "Observación inicial".
- **Tests:** jest 108 suites / 1318 ✓ (3 tests P13 en `evidence-label.test.ts`), tsc ✓, eslint ✓. **Visual:** simulador iOS, cuenta dev: "PATRÓN DETECTADO · 11 días comparados · Con entreno 8 · Sin entreno 3" ✓ (antes de P13; con P13 esa tarjeta dice "Observación inicial").
- **Next recommended ticket:** ST-005 corte 3 (combo + sorpresa) o ST-006.

### 2026-10-13 — ST-005 corte 3 (combo y sorpresa con el mismo contrato) — rama `master-plan-integrity`

- **As-is:** "Tu día fuerte" (`StrongDayCard`) decía "temprano" solo por madurez y "Lo que no sabías" (`SurpriseHero`) no declaraba etiqueta ni muestra.
- **Cambio:**
  - `surprise.ts` + `bedtime.ts`: `Surprise.sample` en los 6 detectores con los mismos conteos con los que deciden (noche corta, proteína×entreno, pasos, día que se rompe, rescate, hora de dormir).
  - `evidence-label.ts`: `PatternSample.total` opcional para grupos que se traslapan (el rescate compara "el día después" contra TODOS tus días: sumar contaría dos veces).
  - `MonthSegment.tsx`: kicker "Lo que no sabías · <etiqueta>" + línea de muestra; "Tu día fuerte · <etiqueta>" (reemplaza "· temprano") + línea de muestra. En el combo la muestra es la que la tarjeta ENSEÑA: los días completos de las barras en kcal (`gap.withDays/restDays`); sin prueba en kcal, `occurrences/restDays` del conteo de déficit. La etiqueta usa la misma regla P13 (madurez + ≥5 por grupo). "★ Día fuerte armado" se queda como kicker del estado completo.
- **Tests:** jest 108 / 1322 ✓ (4 nuevos en `evidence-label.test.ts`), tsc ✓, eslint ✓.
- **Visual:** la cuenta dev hoy no tiene combo ni sorpresa (no se pueden ver). Sí se ve P13: la tarjeta "Con entreno 8 · Sin entreno 3" dice "OBSERVACIÓN INICIAL" ✓.
- **Pendiente de ST-005:** `generated_at`/estado del hallazgo e invalidación al corregir datos (§7), y `DominantPatternCard` (vista no-patterns).
- **Next recommended ticket:** cerrar ST-005 (estado/invalidación) o ST-006.

### 2026-10-13 — ST-005 corte 4 (invalidación al corregir datos) — rama `master-plan-integrity`

- **Auditoría (agente Explore, verificada en código):** lo que ve la beta (feed de Descubre = `DayPresent` + `MonthSegment view="patterns"`) se calcula en el cliente desde queries `['orbit', …]` + metas del brief. Comidas (crear / editar / mover de día / borrar), entreno, sueño, agua y descanso YA invalidan `queryKeys.orbit.all`; zona horaria también (suscriptor en `lib/queryClient.ts`). Huecos encontrados:
  1. **[beta, Android]** la tarea de fondo de Health Connect (`backgroundHealthSync`, sin QueryClient) escribe y fija `last_sync`; al volver a la app el sync queda en throttle y nadie invalida → Descubre con datos de antes del sync.
  2. **[beta]** registrar peso (`useAddMeasurement`, `useInsertInitialWeight`) no invalidaba orbit (`daily_signals.weight_kg`).
  3. **[beta, bajo]** un sync del reloj solo con pasos no invalidaba orbit (`stepDays` fuera de la condición).
  4. **[dev]** cambiar la meta (`useUpsertMacroTargets`) solo invalidaba el brief; el reporte persistido (`compute-findings` lee `macro_targets` en el servidor) quedaba viejo.
- **Cambio:** `features/wearables/hooks.ts` (sello `seenSyncStamp` por sesión: si el `last_sync` guardado no es el que esta sesión ya reflejó, invalida orbit/wearables/progress aunque esté en throttle; `stepDays` en las dos condiciones), `features/progress/hooks.ts` y `features/profile/hooks.ts` (peso → `orbit.all`), `features/macros/hooks.ts` (meta → `orbit.all`).
- **Costo aceptado:** al arrancar la app el primer chequeo en throttle invalida orbit una vez (el sello de la sesión empieza vacío). Una recarga de queries, sin escritura.
- **Tests:** jest 108 / 1322 ✓, tsc ✓, eslint ✓. Sin test unitario de hooks (no hay harness de hooks en el repo); **falta validar en Android** con la tarea de fondo real.
- **Huecos NO tocados (dev-gated, registrados):** `comboChatHash` no incluye días/hechos (transcript de AsyncStorage puede rehidratarse sobre evidencia cambiada; el cache del servidor sí incluye los hechos); `hashFindings` no incluye `evidenceDates`; `compute-findings` nunca borra/cierra findings ni hipótesis que dejaron de calificar (`ignoreDuplicates` congela texto/confianza; `experiment-lifecycle` puede aceptar una hipótesis huérfana `open`); `priorFindings` lee reportes viejos congelados. Por diseño: `seen_combos` (histéresis), `revelations` y `weekly_readings` inmutables.
- **`DominantPatternCard`:** solo se renderiza con `ORBITA_SINGLE_FEED` apagado (ruta vieja de segmentos) → sin etiqueta, no lo ve nadie.
- **Next recommended ticket:** ST-006 (detalle de evidencia: qué sabemos / qué no). Antes de abrir IA/experimentos a la beta: cerrar los huecos dev de arriba (ticket nuevo ST-011).

### 2026-10-13 — ST-006 corte 1 (detalle de evidencia: lo que todavía no sabemos) — rama `master-plan-integrity`

- **As-is:** `EvidenceModal` ya mostraba etiqueta, título, barras, "why", caption, muestra y fechas. Faltaban los límites del hallazgo (D-03 "qué no sabemos").
- **Bug encontrado al validar (preexistente):** el modal mandaba a "aún sin registro este mes" toda barra con `value === 0`, aunque tuviera días (`total > 0`). En la cuenta dev: "Sin entreno: aún sin registro este mes." mientras la muestra decía "Sin entreno 3". 0 de 3 días es evidencia (el lado que no se dio), no un hueco; además escondía justo la barra de la comparación.
- **Cambio:**
  - `_shared/intelligence/evidence-label.ts`: `evidenceUnknowns(p, stage)` (puro; constancias → nada; patrones → "Por qué pasa. Esto muestra que coincidieron en tus días, no que una cosa cause la otra." + el límite de muestra: grupo chico con su conteo y el mínimo P13, o historia temprana) y `splitEvidenceBars(bars)` (con denominador: se dibuja si hay días aunque valga 0).
  - `MonthSegment.tsx`: helper `withEvidence(p)` en las 3 entradas al modal (tarjeta, "También encontré", push N9) y sección "Lo que todavía no sabemos" al pie del modal.
- **Tests:** jest 108 / 1331 ✓ (9 nuevos), tsc ✓, eslint ✓.
- **Visual:** simulador iOS, cuenta dev: sección "LO QUE TODAVÍA NO SABEMOS" con las dos líneas ✓ (captura antes del arreglo de barras). El arreglo de la barra en 0 NO se vio en pantalla (la tarjeta quedó bajo la barra de tabs y la automatización no alcanzó el botón): verificar a mano.
- **Copy propuesto, pendiente de visto bueno de la dueña:** título "Lo que todavía no sabemos" y las dos frases de arriba.
- **Fuente (decisión de la dueña, 13 oct 2026: "que salgan de ambos registros"):** `patternSourceLine(id, signals)` en `evidence-label.ts`. La comida siempre es registro tuyo; sueño y entreno pueden venir del reloj (`sleep_source` / `workout_source`, que en el motor son solo procedencia). Línea del modal: "Con tus registros", o "Con tus registros y tu smartwatch" si algún día de esa dimensión vino del reloj. Un descanso marcado por el reloj no cuenta como entreno del reloj. Tests: jest 108 / 1335 ✓.
- **Pendiente ST-006:** detalle para "Lo que no sabías" (hoy no abre modal).

### 2026-10-13 — ST-006 corte 2 (detalle de "Lo que no sabías") — rama `master-plan-integrity`

- **As-is:** la tarjeta "Lo que no sabías" (`SurpriseHero`) no abría nada: sin fechas, sin fuente, sin límites.
- **Cambio:**
  - `surprise.ts` / `bedtime.ts`: `Surprise.daysLabel` (qué son los días de `days`; en hora de dormir son las noches tarde, no la fila fuerte).
  - `evidence-label.ts`: `patternSourceLine` cubre las sorpresas (noche corta → sueño, proteína×entreno → entreno, pasos y hora de dormir → siempre "Con tus registros y tu smartwatch", día que se rompe y rescate → comida).
  - `MonthSegment.tsx`: la tarjeta es tappable con "Ver el detalle →"; nuevo `SurpriseDetailModal` (etiqueta, frase, filas, muestra, fuente, "<días>: fueron el …", "Lo que todavía no sabemos"). `SurpriseRows` y `EvidenceUnknowns` compartidos con el modal de patrones.
- **Tests:** jest 108 / 1339 ✓, tsc ✓, eslint ✓.
- **Visual:** la cuenta dev no tenía sorpresa; con autorización de la dueña se insertaron 28 comidas de prueba (14 días con pasos del reloj y sin comida; `notes = 'claude-st006-preview'`, nombre "(prueba ST-006)"), simuladas antes con el motor. Tarjeta en simulador ✓: "LO QUE NO SABÍAS · PATRÓN DETECTADO", pasos 9 de 11 vs 1 de 11, 22 días comparados. La dueña decidió DEJAR esas comidas. El modal no se abrió por automatización.
- **ST-006 queda:** D-03 cubierto para patrones del mes y sorpresas. El combo ("Tu día fuerte") tiene su propio reveal y "Tus días así"; sin "qué no sabemos" todavía.
- **Next recommended ticket:** ST-007 (Hoy: un hallazgo calificado destacado + estado vacío honesto).

### 2026-10-13 — ST-006 corte 3 ("Lo que no sabías" como momento de descubrimiento) — rama `master-plan-integrity`

- **Pedido de la dueña:** "si es un patrón detectado la UI debe estar a la altura… inspirada en fitness… se supone que es un nuevo descubrimiento". Revisado con target-user, product-benchmark y uxui-specialist. Rechazados en el camino: calendario de días comparados (repetía los anillos) y todo en un solo color.
- **Cambio:**
  - Motor (`surprise.ts`, `bedtime.ts`): `Surprise.compare` (aciertos/total/días por lado, solo hallazgos de tasa), `otherDays` (de promedio), `hitDays`, `threshold` (pasos) y `surpriseToday()` puro ("Hoy llevas N pasos. Te faltan M para los X." / "ya pasaste los X"; sin dato de hoy → nada).
  - `features/orbit/components/SurpriseDetail.tsx` (nuevo): pantalla completa; eyebrow en el color del dato ("Nuevo patrón encontrado" la 1a vez, luego la etiqueta); íconos de lo que se cruza; anillo héroe con conteo y el otro lado en fila chica; frase; Hoy; evidencia en una línea; "Lo que todavía no sabemos" al pie; "Listo" en pastilla. 1a apertura: llenado + conteo + corona de chispas + háptico (salteable, sin animación con reduce-motion).
  - `evidence-highlight.ts`: looks de las sorpresas (pasos naranja, sueño índigo, proteína coral, déficit oro) e íconos `walk` / `bed-clock`.
  - `features/orbit/surprise-seen.ts` (nuevo): qué revelaciones ya viste, solo en el teléfono (AsyncStorage); no toca `seen_combos`.
- **Tests:** jest 108 / 1345 ✓, tsc ✓, eslint ✓. **Visual:** simulador iOS, cuenta dev (con preview temporal revertido): conteo a mitad ✓, final con chispas ✓. El bloque Hoy no se vio (sin pasos hoy en dev).

### 2026-10-13 — ST-006 corte 4 (corte de pasos exacto) — rama `master-plan-integrity`

- **As-is:** `stepsDeficit` nombraba el corte redondeado hacia abajo a 500 (3,490 → "3,000 pasos o más"). Días de 3,030 y 3,247 quedaban en "menos pasos" aunque la frase dijera 3,000, y "te faltan N para los 3,000" prometía de más.
- **Decisión de la dueña:** "que sea exacto".
- **Cambio:** `stepsLabelCut(cut, maxLow)` en `surprise.ts`: redondea a 100 hacia abajo solo si sigue por encima del día con más pasos del grupo bajo; si no, el corte tal cual. Frase, filas, anillo y Hoy usan ese mismo número. Cuenta dev: "3,400 pasos o más", 9 de 11 contra 1 de 11.
- **Tests:** jest 108 / 1348 ✓ (3 nuevos: redondeo, fallback al corte y propiedad "separa exacto"), tsc ✓, eslint ✓.

### 2026-10-13 — ST-006 corte 5 ("Tu día fuerte" con lo que todavía no sabemos) — rama `master-plan-integrity`

- **Cambio:** `StrongDayCard` (`MonthSegment.tsx`) muestra "Lo que todavía no sabemos" como nota al pie, con `evidenceUnknowns` sobre la MISMA muestra que enseña la tarjeta (días completos de las barras, o el conteo de déficit). Reutiliza `EvidenceUnknowns` de `SurpriseDetail.tsx`.
- **Tests:** jest 108 / 1348 ✓, tsc ✓, eslint ✓. **Visual:** no verificado (la cuenta dev no muestra combo hoy).
- **ST-006 queda:** D-03 cubierto en las tres superficies de evidencia de Descubre (patrones del mes, "Lo que no sabías", "Tu día fuerte"). Falta solo validación visual del combo.
- **Push:** la dueña pidió subir la rama; el push desde la sesión fue denegado por permisos, queda para que lo corra ella.
- **Next recommended ticket:** ST-007 (Hoy: hallazgo calificado destacado + estado vacío honesto).

### 2026-10-13 — ST-006 corte 6 (tarjeta del feed con la gramática del detalle) — rama `master-plan-integrity`

- **As-is:** la tarjeta "Lo que no sabías" seguía en oro, sin íconos ni anillo, con la frase pegada a las filas, y decía "Con datos de tu smartwatch" mientras el detalle decía "con tus registros y tu smartwatch".
- **Cambio:** `SurpriseCard` en `SurpriseDetail.tsx` (reemplaza `SurpriseHero` de `MonthSegment.tsx`): marco con borde en el color del dato, íconos + eyebrow en ese color, anillo chico (o valor de promedio) junto a la frase, el otro lado, evidencia con la fuente unificada (`patternSourceLine`) y "Ver el detalle →".
- **Tests:** jest 108 / 1348 ✓, tsc ✓, eslint ✓. **Visual:** simulador iOS, cuenta dev ✓ (margen inferior corregido después de la captura).

### 2026-10-13 — ST-007 corte 1 (Hoy: el hallazgo destacado) — rama `master-plan-integrity`

- **Decisiones de la dueña:** el destacado va bajo el emblema (entre la CoachLine y "Tu día"); sin hallazgo calificado no se dibuja nada (el vacío no promete; la línea de lectura temprana de "Tu día" sigue igual). Nota: "Tu día" sigue siendo la única tarjeta de LECTURA del día; el destacado es un descubrimiento, no una lectura.
- **Cambio:**
  - `features/orbit/featured-discovery.ts` (nuevo, puro): `pickSupportPatterns` (movido de `MonthSegment`) y `featuredOf` (sorpresa → combo → primer patrón → null).
  - `features/orbit/useFeaturedDiscovery.ts` (nuevo): la selección del feed de Descubre MOVIDA de `MonthSegment` (sorpresa, combo con histéresis, patrones de apoyo, madurez, primera señal). Descubre y Hoy leen el mismo hook → mismo id, misma etiqueta. Marcar el combo como visto sigue siendo solo de Descubre. La ventana de 90 días ya estaba en caché en Hoy (sin fetch extra).
  - `evidence-label.ts`: `comboEvidenceSample` (la muestra de "Tu día fuerte", compartida con Hoy).
  - `SurpriseDetail.tsx`: `DiscoveryCard` (marco común), `evidenceLineOf`; `SurpriseCard` con `ctaLabel` y `compact`.
  - `features/orbit/components/FeaturedDiscoveryCard.tsx` (nuevo): sorpresa / combo (`comboLook`, diferencia en kcal o conteo) / patrón; CTA "Ver en Descubre".
  - `app/(tabs)/index.tsx`: el destacado bajo la CoachLine, solo hoy (no al ver un día pasado). Tocarlo: `requestOrbitEvidence(id)` + `requestOrbitSegment('mes')` + navegar; `MonthSegment` abre ESE hallazgo (sorpresa → su detalle; patrón → su evidencia; combo → su tarjeta ya encabeza el feed).
- **Tests:** jest 109 / 1354 ✓ (`featured-discovery.test.ts`, 6), tsc ✓, eslint ✓. **Visual:** Hoy en simulador iOS, cuenta dev ✓ ("Lo que no sabías · Patrón detectado", 9/11, "Ver en Descubre"). **No verificado:** el toque Hoy → Descubre (la automatización de toques no alcanza).
- **Fuera de este corte (P1):** eventos `insight_presented/opened` (H-04, va con consentimiento en ST-008).

### 2026-10-13 — ST-007 corte 2 (el hallazgo en Hoy solo mientras es nuevo, como franja) — rama `master-plan-integrity`

- **Pedido de la dueña:** "¿qué diferencia hay entre esos dos cards?", "el color rompe con Hoy", "¿las dos tarjetas son necesarias?". Revisado con uxui-specialist y product-benchmark: "Tu día" responde "¿qué hice?" (cambia cada día, se queda siempre); el hallazgo responde "¿qué significa?" (su valor es la sorpresa, que se gasta). Decisión: el hallazgo en Hoy **solo mientras es nuevo**, como **franja** en la paleta de Hoy.
- **Cambio:**
  - `features/orbit/hoy-discovery.ts` (nuevo, puro): `hoyDiscoveryVisible` (no abierto y mostrado en < 3 días distintos), `markHoyDiscoveryShown/Opened`, `hoyDiscoveryModel` (eyebrow "Nuevo patrón encontrado" / "Nueva observación", frase, números en texto, evidencia).
  - `features/orbit/hoy-discovery-store.ts` (nuevo): el estado vive solo en el teléfono (AsyncStorage + caché de query).
  - `features/orbit/components/HoyDiscoveryStrip.tsx` (nuevo; reemplaza la tarjeta del corte 1): sin contenedor, línea `oroHairline` a la izquierda, eyebrow oro, sin anillo, CTA "Ver el patrón ›" en magenta (acción).
  - `app/(tabs)/index.tsx`: franja solo si es nueva; marca el día mostrado; al tocarla la marca abierta y abre ESE hallazgo en Descubre.
  - `MonthSegment.tsx`: abrir el hallazgo en Descubre (sorpresa o evidencia) también lo gasta en Hoy.
  - `TuDiaCard.tsx`: "Descubre ›" → "Ver tu día ›" (cada enlace dice adónde lleva).
- **Tests:** jest 110 / 1360 ✓ (`hoy-discovery.test.ts`, 6), tsc ✓, eslint ✓. **Visual:** Hoy en simulador iOS ✓.
- **Pendiente (propuesto, no hecho):** punto sin número en el ícono de Descubre mientras haya un hallazgo sin ver; revisar con voice-and-copy la contradicción "Hoy quedó. Una estrella más" (coach) vs "Hoy quedó poco registrado" (Tu día); eventos H-04 en ST-008; pasar la regla "nuevo = abierto o 3 días" por manifesto-reviewer.

### 2026-10-14 — ST-007 corte 3 (Hoy solo avisa) + fix de la corona + merge a `main`

- **Pedido de la dueña:** "la gente casi no lee": Hoy solo avisa que hay algo nuevo; el detalle con sus números vive en Descubre.
- **Cambio (ST-007 c3, `84fe2a4`):** `HoyDiscoveryStrip.tsx` pasa de franja con números/muestra/CTA a UNA fila tocable (ícono del detalle en círculo oro + "Nuevo patrón" / "Nueva observación" + título de 4-6 palabras + chevron magenta). `hoyDiscoveryModel` ya no lleva `numbers`/`evidence`; títulos cortos de `Surprise.short` (nuevo campo en los 6 detectores de `surprise.ts` / `bedtime.ts`), `PATTERN_SHORT` para patrones de apoyo y `comboShort` ("Tu día fuerte: …"). Tests: `hoy-discovery.test.ts` 7 ✓, tsc ✓. Visual: simulador iOS ✓ (aprobada por la dueña).
- **Fix fuera de ticket (`9e91401`, pedido por la dueña):** la corona de "Entrené" (RingCelebration) quedaba ~40 pt bajo el emblema al registrar Fuerza a mano. Causa: medía durante el hold del chip (`CHIP_HOLD_MS` 450 ms), antes de que el check-in se recogiera. `CELEBRATE_SETTLE_MS = CHIP_HOLD_MS + CHECKIN_LAYOUT_MS + 60`. Falta validar en iPhone y Android (release).
- **Merge:** `master-plan-integrity` → `main` por fast-forward (`6c9add8..9e91401`, 18 commits). Edges que importan `_shared/intelligence` desplegadas por la dueña el 14 oct 2026: `daily-intelligence`, `compute-findings`, `weekly-reading`, `experiment-lifecycle`, `stelar-insight`. Falta confirmar que arrancan (sin `BOOT_ERROR`).
- **Next recommended ticket:** ST-008.

### 2026-10-14 — ST-008 corte 1 (recorrido de un hallazgo + interruptor de analítica) — rama `master-plan-integrity`

- **Decisiones de la dueña:** analítica activa por defecto con interruptor en Ajustes, guardado en `profiles` (vale en todos los dispositivos); el "¿te sirvió?" (`insight_feedback_submitted`) va en el corte 2.
- **Cambio:**
  - `features/orbit/insight-events.ts` (puro) + `insight-events-store.ts`: `insight_eligible` (lo que pinta el feed, una vez al día por hallazgo), `insight_presented` (una vez al día por hallazgo y superficie, con la tab a la vista) e `insight_opened` (cada apertura, con `from` hoy/descubre/push y `target`). Metadata: `source: 'discovery'`, `finding_id`, `kind`, `label`, `stage`; nunca datos de comida, peso o sueño. Dedupe en el teléfono (AsyncStorage, en fila).
  - `featured-discovery.ts`: `qualifiedDiscoveries` (sorpresa → combo → apoyo); `featuredOf` = su primero. `hoy-discovery.ts`: `discoveryLabel` (misma etiqueta que se ve). `useFeaturedDiscovery` expone `qualified` e `insightMetaOf`.
  - `pending-segment.ts`: el buzón de evidencia lleva `from` ('hoy' | 'push'); Descubre manda `insight_opened` al consumirlo (combo desde Hoy → `feed_card`). Cierra H-04 de ST-007.
  - Hoy (`index.tsx`): eligible + presented de la fila. Descubre (`MonthSegment.tsx`): presented del protagonista + opened en sorpresa, evidencia y reveal del combo.
  - Consentimiento: migración `20261014120000_profiles_analytics_opt_out.sql` (columna, sin policy nueva); `track()` la respeta (con plan B si la columna aún no existe); `AnalyticsCard` en Ajustes bajo Avisos.
- **Tests:** jest 111 / 1367 ✓ (`insight-events.test.ts`), tsc ✓, eslint ✓. **Falta:** aplicar la migración en prod y validar que los eventos lleguen a `analytics_events` con la cuenta beta.
- **No medido todavía:** presentado de los patrones de apoyo y de "Lo que no sabías" cuando no son el protagonista (sin medición de visibilidad en el scroll); `followup_viewed` y `return_after_gap`.

### 2026-10-14 — ST-008 corte 2 ("¿Esto coincide con tus días?") — rama `master-plan-integrity`

- **Decisión de la dueña:** "No coincide" saca el hallazgo de Hoy; en Descubre se queda (es su evidencia).
- **Cambio:**
  - `features/orbit/insight-feedback.ts` (puro): respuestas `matches` / `no_match` / `unsure`; la primera se queda; lectura limpia de lo guardado.
  - `insight-feedback-store.ts`: la respuesta vive en el teléfono (AsyncStorage + caché de query) y se manda `insight_feedback_submitted` con la metadata del hallazgo + `answer`. No cambia la detección (opinión ≠ evidencia, §11).
  - `components/InsightFeedback.tsx`: pregunta + 3 botones neutros del mismo peso; al responder, línea quieta. Al pie del detalle de "Lo que no sabías" (`SurpriseDetailModal`) y de la evidencia de un patrón del feed (`EvidenceModal`, solo hallazgos calificados).
  - Copy revisado con voice-and-copy: "¿Esto coincide con tus días?" · "Sí, me pasa" / "No coincide" / "No sé" · cierre "Gracias. Queda anotado." (o "Anotado. Ya no te lo mostramos en Hoy." con "No coincide"); se descartó "lo tomo en cuenta" porque prometía un efecto en el motor que no existe.
- **Tests:** jest 112 / 1371 ✓ (`insight-feedback.test.ts`), tsc ✓, eslint ✓. **Visual:** no verificado.
- **Nota:** abrir el detalle ya saca el hallazgo de Hoy (ST-007), así que la regla de "No coincide" hoy no cambia nada visible; se marca explícito por si la pregunta vive en otra superficie después.

### 2026-10-14 — ST-009 corte 1 (denominadores de Progreso) — rama `master-plan-integrity`

- **Auditoría (agente Explore, verificada en código):** H1 (alta) `daysInDeficit` y `historyTrends` metían HOY abierto debajo del piso al "X de Y en déficit" (Cuerpo, Historia y la barra "Déficit constante" de Descubre); H2 "Comida registrada" y "Entreno" dividían entre 30 días calendario aunque la usuaria llevara menos; H3 "más que el mes pasado" comparaba conteos con denominadores distintos y "antes" de registro/entreno salía sin mínimo; H4 el promedio de proteína mezclaba parciales y hoy, con tres reglas distintas.
- **Decisiones de la dueña:** denominador "desde que empezaste" (primer día con datos; hoy entra solo si ya tiene el dato); proteína promedia solo días completos (misma regla que P12).
- **Cambio:**
  - `_shared/intelligence/deficit.ts`: `isOpenBelowFloor` (la regla de ST-002 en un solo lugar; `monthCalendar` la usa). `day-quality.ts`: `countsForProteinAverage`.
  - `month-built.ts`: `daysInDeficit` y `monthReveals` aceptan `openDay`; Progreso › Cuerpo y Descubre lo pasan.
  - `features/progress/logic.ts` `historyTrends`: denominadores desde el primer día, hoy abierto fuera del déficit, `prev` con su propio denominador y mínimo `MIN_PREV_DAYS` en todas las tarjetas, "mejoró" por proporción ("… más seguido que el mes pasado"), proteína de días completos. `proteinAverageComparison` (Métrica › Músculo) con la misma base. `HistoryTrends.tsx`: "El mes pasado: X de Y" con su denominador; nota "De tus N días completos con proteína."
- **Tests:** jest 112 / 1378 ✓ (nuevos en `history-trends.test.ts` y `month-built.test.ts`), tsc ✓, eslint ✓. **Visual:** no verificado. Sin cambio en el servidor (los callers del edge no pasan `openDay`).
- **Pendiente (baja):** foco de Destacados con 30 d vs Descubre 90 d (H5); `firstDataDay` de Constancia desde la ventana `span` (H6); estrellas vs conteo de entreno en Constancia (H7); "DÍA N" de la tarjeta para compartir (H8); campos muertos (H9); la barra de proteína de Descubre (`monthReveals` `proteina`) sigue contando parciales en su denominador.

### 2026-10-14 — ST-010 corte 1 (Lectura Semanal: integridad, N8 y cliente) — rama `master-plan-integrity`

- **Auditoría (agente Explore, altos verificados en código):** construida y doble-gateada (`WEEKLY_READING_ENABLED` + `aiEnabledForEmail`; solo 2 cuentas). Hallazgos: H1 palanca "entre semana" celebraba días debajo del piso; H2 ✦ en N8; H3 N8 se cancelaba el mismo lunes; H4 "de 7" calendario; H5 ritmo kg mezclaba promedio con parciales vs TDEE sin ellos y salía con TDEE temprano; H6 proteína con parciales y "toda la semana"; H7 "finde lo más alto" contaba días, no kcal; H8 se congelaba al montar Hoy; H9 `reading:null` persistido; H11 "0 en déficit"; H12 sin forma de releer (Semana ya no se monta con `ORBITA_SINGLE_FEED`). Bajos: `todayIso` sin validar en el server, `opened_at` reescribible por la propia usuaria, sin cron, copy del estado vacío.
- **Decisiones de la dueña:** ritmo en kg solo con TDEE sólido y días completos; se congela al tocarla; fila en Descubre para releer.
- **Cambio:**
  - Motor (`weekly-reading.ts`): "N de M" desde el primer día con datos; sin "0 en déficit"; ritmo solo con TDEE `solida` y promedio de días completos (y "sostener tu peso" si ≈0); con TDEE temprano, sin kg; "entre semana" = días en la banda sana; "finde" exige promedio de kcal mayor que entre semana; proteína con `countsForProteinAverage`. `weekHasReading` (misma condición del motor, sin generar).
  - N8 (`invite.ts`, `scheduler.ts`, `hooks.ts`): sin ✦; `nextReadingDate` (el lunes antes de la hora suena hoy) y la garantía mide la semana que lee ESE lunes.
  - Cliente: `useWeeklyReadingAvailability` (Hoy avisa sin generar; lee `opened_at` directo de la tabla); `staleTime` 0 para el silencio; gate propio en `/weekly-reading`; `WeeklyReadingRow` en el feed de Descubre bajo el día.
- **Tests:** jest 112 / 1389 ✓, tsc ✓, eslint ✓. **Visual:** no verificado. **Deploy pendiente:** edge `weekly-reading` (el motor cambió).
- **Falta para beta controlada:** deploy de la edge; validar en dev build (pantalla, Hoy, Descubre y N8); validar `todayIso` en el server (±1 día) y blindar `opened_at` (bajos); actualizar `docs/weekly-reading-spec.md`; abrir el gate a la lista de la beta (no a todas).

### 2026-10-14 — Descubre se lee en 3 segundos (fuera de ticket, pedido por la dueña) — rama `master-plan-integrity`

- **Pedido de la dueña:** "es demasiada lectura, yo no pagaría por esto". Revisado con product-benchmark y uxui-specialist. La dueña RECHAZÓ quitar el multiring y el calendario ("¿enserio vas a quitar lo de valor?"): se recorta TEXTO, nunca los visuales.
- **Cambio:**
  - "Lo que no sabías" (`SurpriseCard`): etiqueta, anillo, frase, el contraste ("Menos pasos: 1 de 11") y "Ver el detalle"; la muestra y la fuente pasan al detalle; nueva línea de HOY (`surpriseToday`) cuando hay dato de hoy.
  - "Tu día fuerte" (`StrongDayCard`): etiqueta, frase, mosaicos de hoy, número héroe y "Ver el detalle →"; sin el eyebrow "Lo que te sostiene".
  - Detalle propio `ComboDetailModal` (`SurpriseDetail.tsx`) con la gramática del de la sorpresa: pantalla completa, íconos (`comboIcons`), héroe = diferencia en kcal con dos barras estilo Destacados de Salud (sin kcal, anillo de días en déficit), frase, Hoy en chips, evidencia y días en una línea, límites al pie, "¿Coincide?" y "Listo". Desde Hoy, el combo abre este detalle.
- **Tests:** jest 112 / 1389 ✓, tsc ✓, eslint ✓. **Visual:** simulador iOS, la dueña: "mucho mejor".

### 2026-10-14 — ST-010 corte 2 (blindaje antes de la beta) — rama `master-plan-integrity`

- **Cambio:** edge `weekly-reading` acepta `todayIso` solo a ±1 día de la fecha del servidor; migración `20261014150000_weekly_readings_opened_at_guard.sql` (auditada por rls-auditor: OK): `opened_at` nace null, solo pasa de null a `now()` del servidor y no cambia. `docs/weekly-reading-spec.md` al día (migraciones reales, entradas Hoy/Descubre, N8, reglas ST-010).
- **Gate a la beta (decisión dueña 14 oct 2026):** `weeklyReadingEnabledFor(email, is_beta)` en `lib/featureFlags.ts` (master + dev O `profiles.is_beta`) y `useWeeklyReadingOn()` como única fuente para Hoy, Descubre, `/weekly-reading`, N8 y Semana. Test `lib/__tests__/weekly-reading-gate.test.ts`.
- **Pendiente:** aplicar la migración y desplegar la edge (dueña); validar en dev build ANTES de que el build llegue a la beta.

---

## 11. DECISION LOG — DO NOT SILENTLY REVERSE

| Date       | Decision                                                                                                                                                                          | Rationale                                                                                                                                                              | Revisit trigger                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2026-10-13 | Maintain sustainable weight-loss + self-understanding focus                                                                                                                       | Differentiates from trackers and prescribing coaches                                                                                                                   | User validation disproves value thesis                                              |
| 2026-10-13 | Deterministic pattern detection; AI only explanation                                                                                                                              | Integrity and auditability                                                                                                                                             | Formal architecture review                                                          |
| 2026-10-13 | Finish input integrity before broad insight rollout                                                                                                                               | Incomplete input produces misleading patterns                                                                                                                          | Gate A passed                                                                       |
| 2026-10-13 | Preserve zodiac constellations as knowledge milestone metaphor                                                                                                                    | Product identity + non-punitive progress                                                                                                                               | Tested comprehension fails                                                          |
| 2026-10-13 | No weight number/goal percentage on Home                                                                                                                                          | Weight is context, not emotional centerpiece                                                                                                                           | Explicit product decision after user research                                       |
| 2026-10-13 | No generic daily instruction coach, diets or routines                                                                                                                             | Outside product scope                                                                                                                                                  | Formal strategy change                                                              |
| 2026-10-13 | Evidence is not subjective feedback; feedback enriches context                                                                                                                    | Prevent evidence corruption                                                                                                                                            | Data governance review                                                              |
| 2026-10-13 | Do not paywall first meaningful discovery                                                                                                                                         | Need experienced value before purchase                                                                                                                                 | Pricing experiment with evidence                                                    |
| 2026-10-13 | Prioritize insight surfacing and trust, not more dashboards                                                                                                                       | Current UX hides differentiator                                                                                                                                        | Post-beta analytics and interviews                                                  |
| 2026-10-13 | "Déficit" se afirma solo dentro de la banda sana [0.6×meta, meta] (`isDeficitDay`) también para HOY en curso; debajo del piso el día es "abierto", sin veredicto ni "poco"        | Un registro a medias no es déficit (dato o silencio); unifica Hoy, microlectura, Descubre Día, calendario y Semana con la regla que ya usaban el cierre y el historial | Decisión dueña sobre días pasados a medio registrar (§12)                           |
| 2026-10-13 | Días pasados debajo del 60% siguen como "comiste poco" en el calendario                                                                                                           | Decisión de la dueña (§12 P11)                                                                                                                                         | Nueva evidencia de usuarias                                                         |
| 2026-10-13 | El promedio de kcal del motor (`avgCalories`, hecho `avg_calories`, contexto de la IA) usa SOLO días completos y declara la base (`completeDays`)                                 | Decisión de la dueña (§12 P12-a): un parcial no baja el promedio ni infla el déficit. La Lectura Semanal mantiene su excepción (parciales incluidos, copy declarado)   | —                                                                                   |
| 2026-10-13 | "Patrón detectado" exige madurez general Y ≥5 días por grupo comparado; si no, "Observación inicial"                                                                              | Decisión de la dueña (§12 P13): la etiqueta no debe sobreafirmar un lado con 3 días                                                                                    | —                                                                                   |
| 2026-10-13 | El detalle de un patrón nombra su fuente; si mezcla registros tuyos y del reloj, nombra ambos ("Con tus registros y tu smartwatch")                                               | Decisión de la dueña: no ocultar que parte de la evidencia viene del reloj, ni que la comida es tuya                                                                   | —                                                                                   |
| 2026-10-13 | El número de pasos que nombra un hallazgo separa EXACTO los dos grupos (redondeo a 100 solo si no mete días del otro grupo)                                                       | Decisión de la dueña: "que sea exacto"; el "te faltan N" no puede prometer de más                                                                                      | —                                                                                   |
| 2026-10-13 | El hallazgo aparece en Hoy solo mientras es NUEVO (hasta abrirlo o 3 días distintos), como franja en la paleta de Hoy; "Tu día" se queda siempre                                  | Decisión de la dueña con product-benchmark: la sorpresa se gasta; un hallazgo fijo se vuelve fondo y compite con el emblema                                            | Apertura por día de exposición; si casi todo se abre el día 1, el corte se sostiene |
| 2026-10-14 | En Hoy el hallazgo nuevo es UNA fila corta (ícono + etiqueta + título de 4-6 palabras), sin números ni muestra; el detalle vive en Descubre                                       | Decisión de la dueña: "la gente casi no lee"; Hoy solo avisa                                                                                                           | Apertura por día de exposición baja frente a la franja                              |
| 2026-10-14 | La respuesta a "¿Esto coincide con tus días?" es opinión: se registra como evento y en el teléfono, no cambia la detección; "No coincide" saca el hallazgo de Hoy, no de Descubre | Decisión de la dueña; opinión ≠ evidencia                                                                                                                              | Muchas respuestas "No coincide" en un mismo detector                                |
| 2026-10-14 | Los "N de M días" de Progreso cuentan desde que empezaste (primer día con datos); hoy entra solo si ya tiene el dato; "mejoró" compara proporciones                               | Decisión de la dueña (ST-009): "4 de 30" se lee como fallaste 26                                                                                                       | —                                                                                   |
| 2026-10-14 | El promedio de proteína usa solo días completos (`countsForProteinAverage`)                                                                                                       | Decisión de la dueña (ST-009), misma regla que P12 para kcal                                                                                                           | —                                                                                   |
| 2026-10-14 | Lectura Semanal: el ritmo en kg solo con TDEE sólido y promedio de días completos; se congela al tocarla (Hoy avisa sin generar); se relee desde una fila en Descubre             | Decisión de la dueña (ST-010); P-06 del plan                                                                                                                           | —                                                                                   |
| 2026-10-14 | En Descubre cada tarjeta se lee en ~3 s; la evidencia vive en el detalle. El multiring y el calendario se quedan                                                                  | Decisión de la dueña ("demasiada lectura"; "¿enserio vas a quitar lo de valor?")                                                                                       | —                                                                                   |
| 2026-10-13 | Plan maestro vive en `docs/STELAR_MASTER_PLAN.md` (copia del original en Downloads)                                                                                               | Persistir el ledger con el repo                                                                                                                                        | —                                                                                   |

---

## 12. OPEN QUESTIONS / PRODUCT OWNER APPROVAL NEEDED

1. Which exact qualifying rules exist for findings and minimum sample sizes? **Do not invent thresholds.**
2. Do findings already have stable IDs, provenance, eligibility and retraction states?
3. Are `daily_signals` and TDEE quality updated after edits and wearable backfills?
4. What is the exact behavior of incomplete days in the current DB and UI?
5. Is there any existing user feedback on discoveries, and where is it stored?
6. Are Weekly Reading milestones computed once, re-computed, or versioned?
7. How does FOCO ranking handle repeated patterns and new evidence?
8. Which visual element identifies actual GPT-based interaction vs deterministic copy?
9. Which consent/telemetry stack is already available?
10. Which Phase 3 tasks are already implemented and tested on current branch?
11. **RESUELTA (dueña, 13 oct 2026): se queda así.** Un día PASADO registrado debajo del 60% de la meta sigue marcándose "comiste poco" en el calendario. No reabrir.
12. **RESUELTA (dueña, 13 oct 2026): opción (a).** `avgCalories` del contexto del motor promedia SOLO días completos y declara la base en `nutrition.completeDays`; implementado en `_shared/intelligence/context.ts`, `facts.ts` (evidenceCount = días completos) y la copia inline de `stelar-insight/index.ts` (pendiente de deploy).

13. **RESUELTA (dueña, 13 oct 2026): mínimo 5 días por grupo.** "Patrón detectado" exige historia madura (etapa > 2) Y ≥5 días en cada grupo comparado (`PATTERN_MIN_DAYS_PER_GROUP` en `_shared/intelligence/evidence-label.ts`); si no, "Observación inicial". No cambia qué patrones aparecen, solo su etiqueta.

**Respuestas verificadas en el repo (ST-001):** P2 → ids estables por detector, sin provenance ni retracción (solo Hypothesis tiene estado). P3 → no hay invalidación server-side; el cliente invalida `queryKeys.orbit.all` en cada mutación; `weekly_readings` es inmutable (un backfill no la actualiza). P4 → ver §10.1. P5 → no existe feedback de insights. P6 → Lectura Semanal se computa una vez (inmutable por trigger). P8 → ✦ = solo chat con IA real (`docs/` regla IA visible). P9 → `analytics_events` sin opt-out. P10 → §10 tabla.

For every unresolved question, prefer inspect → test → discuss over guess → implement.

---

## 13. SUCCESSFUL HANDOFF CHECK

Claude's first response after reading this document should identify: (a) what makes Stelar different; (b) the four tabs' distinct jobs; (c) exact status/unknowns of Phase 1/2/3; (d) the first unblocked ticket; (e) necessary repository checks; (f) data/evidence safety rules; and (g) which aspects should NOT be rebuilt. If any are missing, the handoff is incomplete.
