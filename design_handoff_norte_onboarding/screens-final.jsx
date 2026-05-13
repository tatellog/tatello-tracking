// screens.jsx — Five revised onboarding screens for "Norte"
// Each screen is a fully self-contained React component rendered inside an iOS frame.
// Props: { state, set } where state holds shared form values across screens.

const { useState, useEffect, useRef } = React

// ─────────────────────────────────────────────────────────────
// Animated counter — counts from 0 → target on mount
// ─────────────────────────────────────────────────────────────
function useCounter(target, duration = 1400, startDelay = 200) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target || isNaN(parseFloat(target))) {
      setVal(target)
      return
    }
    const num = parseFloat(target)
    let raf
    const start = performance.now() + startDelay
    const tick = (t) => {
      if (t < start) {
        raf = requestAnimationFrame(tick)
        return
      }
      const p = Math.min(1, (t - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      setVal((num * eased).toFixed(target.toString().includes('.') ? 1 : 0))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return val
}

// ─────────────────────────────────────────────────────────────
// Image placeholder — striped mono-caption slot
// ─────────────────────────────────────────────────────────────
function ImgSlot({ caption, height, style }) {
  return (
    <div className="img-slot" style={{ height, ...style }}>
      <span>{caption}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Manifiesto orb — decorative breathing element
// ─────────────────────────────────────────────────────────────
function ManifOrb() {
  return (
    <div className="manif-orb" aria-hidden="true">
      <div className="core" />
      <div className="ring" />
      <div className="satellite" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 28-day timeline — animated dot row with scan line
// ─────────────────────────────────────────────────────────────
function Timeline28() {
  return (
    <div className="timeline28" aria-hidden="true">
      <div className="track" />
      <div className="scan" />
      <div className="dots">
        {Array.from({ length: 28 }).map((_, i) => {
          let cls = 'd'
          if (i === 0) cls += ' day1'
          else if (i === 27) cls += ' day28'
          return <div key={i} className={cls} style={{ animationDelay: `${0.4 + i * 0.04}s` }} />
        })}
      </div>
      <div className="labels">
        <span className="now">Día 1</span>
        <span>Día 28</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────
function Progress({ step, total = 5 }) {
  // step is 1-indexed
  return (
    <div className="scr-progress">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1
        let cls = ''
        if (idx < step) cls = 'done'
        else if (idx === step) cls = 'active'
        return <span key={i} className={cls} />
      })}
    </div>
  )
}

function Tick() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path
        d="M1 4L4 7L9 1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// 1 · MANIFIESTO  (replaces "365 días")
// ─────────────────────────────────────────────────────────────
function ScreenManifiesto({ onNext }) {
  return (
    <div className="scr">
      <Progress step={1} />
      <ManifOrb />
      <div className="manif-stage">
        <div className="scr-eyebrow" data-anim="0">
          Norte · el manifiesto
        </div>
        <p className="manif-quote" data-anim="1">
          La perfección
          <br />
          no es necesaria.
          <em>La dirección sí.</em>
        </p>
        <div className="manif-rule" data-anim="2" />
        <p className="manif-meta" data-anim="3">
          Esta app te lee patrones, no perfección.
          <br />
          <strong>En 28 días</strong> verás tu primera comparativa.
        </p>
      </div>
      <button className="scr-cta" data-anim="4" onClick={onNext}>
        Empezar →
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 2 · LO QUE SE TE HA ATRAVESADO (originally screen 5, moved up)
// ─────────────────────────────────────────────────────────────
const FRICTIONS = [
  'No me dan ganas de loguear',
  'Me obsesiono con números',
  'Me siento juzgada',
  'Pereza preparar comida',
  'No veo cambios, me frustro',
  'Recaigo en atracones',
]
function ScreenFrictions({ state, set, onNext, onBack }) {
  const sel = state.frictions || []
  const skipped = state.skipFrictions || false

  const toggle = (item) => {
    if (skipped) set({ skipFrictions: false })
    const has = sel.includes(item)
    set({ frictions: has ? sel.filter((x) => x !== item) : [...sel, item] })
  }
  const skip = () => set({ skipFrictions: !skipped, frictions: [] })

  const ready = skipped || sel.length > 0

  return (
    <div className="scr">
      <Progress step={2} />
      <div className="scr-back" onClick={onBack} data-anim="0">
        ‹ Atrás
      </div>
      <div className="scr-eyebrow" data-anim="0">
        Antes de pedirte datos
      </div>
      <h2 className="scr-title" data-anim="1">
        ¿Qué se te <em>ha atravesado</em>
        <br />
        antes?
      </h2>
      <p className="scr-sub" data-anim="2">
        Esto entrena a tu coach. Mientras más honesta, mejor te lee.
      </p>

      <div className="scr-body" style={{ overflowY: 'auto', marginTop: 4 }}>
        {FRICTIONS.map((f, i) => (
          <div
            key={f}
            data-anim={Math.min(i + 3, 7)}
            className={'opt' + (sel.includes(f) ? ' on' : '')}
            onClick={() => toggle(f)}
          >
            <span className="opt-label">{f}</span>
            <span className="opt-tick">{sel.includes(f) && <Tick />}</span>
          </div>
        ))}
        <div data-anim="7" className={'opt neutral' + (skipped ? ' on' : '')} onClick={skip}>
          <span className="opt-label">Prefiero no decir</span>
          <span className="opt-tick">{skipped && <Tick />}</span>
        </div>
      </div>

      <button className="scr-cta" disabled={!ready} onClick={onNext}>
        Continuar →
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 3 · CUÉNTAME DE TI (combines former screens 2 + 3 + 4 + altura)
// ─────────────────────────────────────────────────────────────
function ScreenAboutYou({ state, set, onNext, onBack }) {
  const { name = '', age = '', height = '', sex = '' } = state
  const ready = name.trim().length > 0 && age && height && sex

  return (
    <div className="scr">
      <Progress step={3} />
      <div className="scr-back" onClick={onBack} data-anim="0">
        ‹ Atrás
      </div>
      <div className="scr-eyebrow" data-anim="0">
        Para conocerte
      </div>
      <h2 className="scr-title" data-anim="1">
        <em>Cuéntame</em> de ti.
      </h2>
      <p className="scr-sub" data-anim="2">
        Vive en tu teléfono. Nada se comparte.
      </p>

      <div className="scr-body">
        <div className="fld" data-anim="3">
          <label>Tu nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Anahí"
          />
        </div>
        <div className="fld-row" data-anim="4">
          <div className="fld">
            <label>Edad</label>
            <input
              type="text"
              value={age}
              onChange={(e) => set({ age: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              placeholder="36"
            />
          </div>
          <div className="fld">
            <label>Altura · cm</label>
            <input
              type="text"
              value={height}
              onChange={(e) => set({ height: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              placeholder="170"
            />
          </div>
        </div>
        <div className="fld" data-anim="5">
          <label>Para calcular metabolismo</label>
          <div className="seg">
            <button className={sex === 'F' ? 'on' : ''} onClick={() => set({ sex: 'F' })}>
              Femenino
            </button>
            <button className={sex === 'M' ? 'on' : ''} onClick={() => set({ sex: 'M' })}>
              Masculino
            </button>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--niebla)',
              textAlign: 'center',
              marginTop: 8,
              fontStyle: 'italic',
              fontFamily: 'var(--serif)',
            }}
          >
            metabolismo, no identidad
          </div>
        </div>
      </div>

      <button className="scr-cta" disabled={!ready} onClick={onNext}>
        Continuar →
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 4 · HOY PESAS (revised — smaller number, caveat, "no lo sé")
// ─────────────────────────────────────────────────────────────
function ScreenWeight({ state, set, onNext, onBack }) {
  const { weight = '', skipWeight = false } = state
  const ready = skipWeight || (weight && parseFloat(weight) > 0)
  const animated = useCounter(weight || '0', 1400, 350)
  const [edited, setEdited] = useState(false)

  return (
    <div className="scr">
      <Progress step={4} />
      <div className="scr-back" onClick={onBack} data-anim="0">
        ‹ Atrás
      </div>
      <div className="scr-eyebrow" data-anim="0">
        El punto de partida
      </div>
      <h2 className="scr-title" data-anim="1">
        Hoy <em>pesas</em>…
      </h2>
      <p className="scr-sub" data-anim="2">
        No es un veredicto. Es solo de dónde empezamos.
      </p>

      <div
        className="scr-body"
        style={{ justifyContent: 'flex-start', position: 'relative' }}
        data-anim="3"
      >
        <div className="wt">
          <input
            className="wt-num"
            value={skipWeight ? '—' : edited ? weight : animated}
            disabled={skipWeight}
            onChange={(e) => {
              setEdited(true)
              set({ weight: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) })
            }}
            placeholder="75"
            inputMode="decimal"
          />
          <span className="wt-unit">kg</span>
        </div>
        <div className="wt-ruler" aria-hidden="true">
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} className={'tick' + (i % 5 === 0 ? ' maj' : '')} />
          ))}
        </div>
        <p className="wt-caveat" data-anim="4">
          Es solo el punto de partida.
          <br />
          No es tu valor.
        </p>
        <div
          className="wt-skip"
          data-anim="5"
          onClick={() => {
            setEdited(true)
            set({ skipWeight: !skipWeight, weight: skipWeight ? state.weight : '' })
          }}
        >
          {skipWeight ? 'Sí tengo báscula · anotar peso' : 'No tengo báscula · registrar después'}
        </div>
      </div>

      <button className="scr-cta" disabled={!ready} onClick={onNext}>
        Continuar →
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 5 · TU CITA EN 28 DÍAS (NEW — replaces the empty "Listo" + "despegar" screens)
// ─────────────────────────────────────────────────────────────
function Constellation() {
  // 28 dots arranged in 4 arcing rows of 7
  const rows = 4,
    cols = 7
  const dots = []
  const W = 280,
    H = 120
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      const x = 20 + (c * (W - 40)) / (cols - 1)
      // arc: lower middle, higher edges
      const baseY = 24 + r * 22
      const y = baseY + Math.sin((c / (cols - 1)) * Math.PI) * 6
      dots.push({ x, y, idx })
    }
  }

  return (
    <svg className="const-svg" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <radialGradient id="dot1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFB2C8" />
          <stop offset="100%" stopColor="#E91E63" />
        </radialGradient>
      </defs>
      {dots.map(({ x, y, idx }) => {
        const lit = idx === 0
        return (
          <g key={idx}>
            {lit && <circle cx={x} cy={y} r="9" fill="rgba(233,30,99,0.20)" />}
            <circle
              cx={x}
              cy={y}
              r={lit ? 3.6 : 1.7}
              fill={lit ? 'url(#dot1)' : 'rgba(244,236,222,0.18)'}
            />
            {idx === dots.length - 1 && (
              <circle
                cx={x}
                cy={y}
                r="3.4"
                fill="none"
                stroke="rgba(233,30,99,0.55)"
                strokeWidth="0.8"
                strokeDasharray="1.5 1.5"
              />
            )}
          </g>
        )
      })}
      {/* connecting hairline from first to last */}
      <line
        x1={dots[0].x}
        y1={dots[0].y}
        x2={dots[dots.length - 1].x}
        y2={dots[dots.length - 1].y}
        stroke="rgba(233,30,99,0.18)"
        strokeWidth="0.5"
        strokeDasharray="2 3"
      />
    </svg>
  )
}

function dateIn(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ]
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`
}

function ScreenAppointment({ state, onNext, onBack }) {
  const name = (state.name || 'tú').trim().split(' ')[0]
  const count28 = useCounter('28', 1400, 400)

  // Get date 28 days out
  const d = new Date()
  d.setDate(d.getDate() + 28)
  const dias = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
  const day = d.getDate()
  const month = meses[d.getMonth()]
  const weekday = dias[d.getDay()]

  return (
    <div className="scr">
      <Progress step={5} />
      <div className="scr-back" onClick={onBack} data-anim="0">
        ‹ Atrás
      </div>
      <div className="scr-eyebrow" data-anim="0">
        Tu cita
      </div>

      <div className="scr-body">
        <div className="const-wrap">
          <div className="const-num" data-anim="1">
            {count28}
          </div>
          <div className="const-line" data-anim="2">
            días para tu primera comparativa.
          </div>

          <div data-anim="3" style={{ width: '100%' }}>
            <Timeline28 />
          </div>

          <div className="const-date-block" data-anim="4">
            <div className="const-date-lbl">Nos vemos</div>
            <div className="const-date-val">
              {weekday} <em>{day}</em> {month}
            </div>
          </div>

          <div className="preview-row" data-anim="5">
            <ImgSlot
              caption={
                <>
                  <strong>Día 1</strong>tu foto
                  <br />
                  de hoy
                </>
              }
            />
            <ImgSlot
              caption={
                <>
                  <strong>Día 28</strong>tu foto
                  <br />
                  en 4 semanas
                </>
              }
            />
          </div>

          <p className="const-poet" data-anim="6">
            {name}, vuelves a esta pantalla.
            <br />
            Verás <em>lo que cambió</em>.
          </p>
        </div>
      </div>

      <button className="scr-cta" data-anim="7" onClick={onNext}>
        Empezar mi día 1 →
      </button>
    </div>
  )
}

// Export all screens to window so app.jsx can use them
Object.assign(window, {
  ScreenManifiesto,
  ScreenFrictions,
  ScreenAboutYou,
  ScreenWeight,
  ScreenAppointment,
})
