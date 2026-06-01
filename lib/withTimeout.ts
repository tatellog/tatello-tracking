/*
 * Race a promise against a timeout. Supabase Storage uploads/deletes have
 * no built-in client timeout, so on a stalled connection (large image,
 * flaky simulator network) the request can hang forever — and any spinner
 * tied to the mutation's pending state spins forever with it. Wrapping the
 * network call in withTimeout turns a hang into a recoverable error the UI
 * can surface with a retry.
 */
export class TimeoutError extends Error {
  constructor(message = 'La operación tardó demasiado.') {
    super(message)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}
