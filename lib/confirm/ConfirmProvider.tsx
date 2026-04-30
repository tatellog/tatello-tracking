import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { ConfirmDialog } from './ConfirmDialog'

export type ConfirmAction = {
  /** Stable id used as the resolution value when this action is picked. */
  id: string
  label: string
  /**
   * - `cancel`: pearl bg, ink text, hairline border. Implicit "cancel".
   * - `destructive`: feedbackError bg, pearl text. Used for delete /
   *   sign-out / skip-photos.
   * - `default`: mauveDeep bg, pearl text. The standard go-ahead.
   */
  style?: 'cancel' | 'destructive' | 'default'
}

export type ConfirmRequest = {
  title: string
  description?: string
  actions: ConfirmAction[]
}

type ConfirmContextValue = {
  /**
   * Opens the dialog and resolves with the picked action id, or null
   * when the user dismisses (backdrop tap, Escape, or the cancel
   * action). Mirrors the imperative ergonomics of Alert.alert without
   * the platform-styling tax.
   */
  choose: (req: ConfirmRequest) => Promise<string | null>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

type Pending = {
  request: ConfirmRequest
  resolve: (value: string | null) => void
}

/*
 * One global confirm dialog mounted at the app root. Imperative API
 * (`useConfirm()`) is intentional: it lets us swap Alert.alert call
 * sites one-for-one without restructuring the surrounding logic into
 * useState + JSX-rendered dialogs.
 *
 * Only one dialog can be open at a time. A second `choose()` call
 * while one is open queues itself behind the first by waiting for
 * the previous resolve.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const queueRef = useRef<Pending[]>([])

  const present = useCallback((next: Pending) => {
    setPending((current) => {
      if (current) {
        queueRef.current.push(next)
        return current
      }
      return next
    })
  }, [])

  const dismiss = useCallback((value: string | null) => {
    setPending((current) => {
      if (!current) return null
      current.resolve(value)
      const next = queueRef.current.shift() ?? null
      return next
    })
  }, [])

  const choose = useCallback<ConfirmContextValue['choose']>(
    (request) =>
      new Promise<string | null>((resolve) => {
        present({ request, resolve })
      }),
    [present],
  )

  const value = useMemo(() => ({ choose }), [choose])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        request={pending?.request ?? null}
        onPick={(id) => dismiss(id)}
        onDismiss={() => dismiss(null)}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextValue['choose'] {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>.')
  }
  return ctx.choose
}

/*
 * Convenience helper for the binary "are you sure?" pattern. Returns
 * true when the user confirms, false when they cancel / dismiss.
 *
 * Example:
 *   const confirm = useConfirm()
 *   const ok = await confirmBinary(confirm, {
 *     title: '¿Cerrar sesión?',
 *     description: 'Tus datos se limpian.',
 *     confirmLabel: 'Cerrar sesión',
 *     destructive: true,
 *   })
 *   if (ok) signOut()
 */
export async function confirmBinary(
  choose: ConfirmContextValue['choose'],
  opts: {
    title: string
    description?: string
    cancelLabel?: string
    confirmLabel: string
    destructive?: boolean
  },
): Promise<boolean> {
  const choice = await choose({
    title: opts.title,
    description: opts.description,
    actions: [
      { id: 'cancel', label: opts.cancelLabel ?? 'Cancelar', style: 'cancel' },
      {
        id: 'confirm',
        label: opts.confirmLabel,
        style: opts.destructive ? 'destructive' : 'default',
      },
    ],
  })
  return choice === 'confirm'
}
