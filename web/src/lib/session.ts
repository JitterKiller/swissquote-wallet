/**
 * MOCK Swissquote session (PDR-015). Stands in for the e-banking login: the client id and the
 * KYC name the backend would know. Issue #21 owns the real "Sign in with Swissquote" flow and can
 * replace this module; consumers only use `getSession()` / `setSession()` / `clearSession()`.
 */
export type SwissquoteSession = { clientId: string; displayName: string }

const KEY = 'sq-session:v1'

export function getSession(): SwissquoteSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SwissquoteSession) : null
  } catch {
    return null
  }
}

export function setSession(session: SwissquoteSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}

/** MOCK sign-in: a deterministic client id from the name, as if e-banking had authenticated it. */
export function mockSignIn(displayName: string): SwissquoteSession {
  const slug = displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const session = { clientId: `sq-${slug || 'client'}`, displayName: displayName.trim() }
  setSession(session)
  return session
}
