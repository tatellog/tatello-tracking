// app.jsx — Composes the 5 revised screens into a design canvas
// One artboard per screen, each running inside an iOS device frame.
// Shared state across screens (typed name shows up in the day-28 screen).

const { useState } = React

function Artboard({ time, step, children }) {
  // Wrap the screen content inside the iOS device frame
  return (
    <IOSDevice width={340} height={720} dark={true}>
      {/* Override status bar time per screen */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11 }}>
        <IOSStatusBar dark={true} time={time} />
      </div>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>
    </IOSDevice>
  )
}

function App() {
  // Shared state across screens — pre-filled with realistic values so the canvas
  // shows a "live" run-through, but every field is editable.
  const [state, setState] = useState({
    name: 'Anahí',
    age: '36',
    height: '170',
    sex: 'F',
    frictions: ['No me dan ganas de loguear', 'Me obsesiono con números'],
    weight: '75',
    skipWeight: false,
    skipFrictions: false,
  })
  const set = (patch) => setState((s) => ({ ...s, ...patch }))
  const noop = () => {}

  return (
    <>
      <header className="norte-hero">
        <div className="eyebrow">Norte · sistema final · v3 con imagery + animaciones</div>
        <h1>
          Magenta + <em>Hanken Black.</em>
          <br />
          Las 5 pantallas, vestidas.
        </h1>
        <p>
          Sistema cerrado: fondo cálido oscuro <strong>#0A0608</strong>, acento magenta{' '}
          <strong>#E91E63</strong>, tipografía Hanken Grotesk 900 + Cormorant cursiva.{' '}
          <strong>Nuevo en v3:</strong> orb magenta que respira en el manifiesto, fade-in escalonado
          de cada elemento al cargar, contador animado del peso (0 → 75) y de los días (0 → 28),
          timeline de 28 puntos con día-1 brillando y día-28 con anillo rotando, scan-line
          periódica, y placeholders para tu foto día 1 / día 28. Recarga la página para ver las
          animaciones de nuevo.
        </p>
      </header>

      <DesignCanvas>
        <DCSection
          id="norte-final"
          title="Norte · Onboarding · sistema final"
          subtitle="5 pantallas · Magenta + Hanken Black + Cormorant"
        >
          <DCArtboard id="s1" label="1 · Manifiesto" width={340} height={720}>
            <Artboard time="9:14" step={1}>
              <ScreenManifiesto onNext={noop} />
            </Artboard>
          </DCArtboard>

          <DCArtboard id="s2" label="2 · Lo que te ha costado" width={340} height={720}>
            <Artboard time="9:14" step={2}>
              <ScreenFrictions state={state} set={set} onNext={noop} onBack={noop} />
            </Artboard>
          </DCArtboard>

          <DCArtboard id="s3" label="3 · Cuéntame de ti" width={340} height={720}>
            <Artboard time="9:15" step={3}>
              <ScreenAboutYou state={state} set={set} onNext={noop} onBack={noop} />
            </Artboard>
          </DCArtboard>

          <DCArtboard id="s4" label="4 · Hoy pesas" width={340} height={720}>
            <Artboard time="9:16" step={4}>
              <ScreenWeight state={state} set={set} onNext={noop} onBack={noop} />
            </Artboard>
          </DCArtboard>

          <DCArtboard id="s5" label="5 · Tu cita en 28 días" width={340} height={720}>
            <Artboard time="9:17" step={5}>
              <ScreenAppointment state={state} onNext={noop} onBack={noop} />
            </Artboard>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
