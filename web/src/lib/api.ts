/** Calls the mock Swissquote backend (Next.js route handlers under /api). */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
  return data as T
}
