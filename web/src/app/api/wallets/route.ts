import type { RegisterWalletRequest } from '@/lib/registry'
import { RegistryError, registerWallet } from '@/server/registry'

/**
 * Wallet registry (PDR-022, ADR-021): verifies the passkey-signed ownership statement and
 * links the Account to the client. MOCK auth: the client id comes from the request until
 * the mock Swissquote session (#21) provides it.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterWalletRequest
    return Response.json(await registerWallet(body, new URL(request.url).origin))
  } catch (error) {
    if (!(error instanceof RegistryError)) console.error(error)
    const status = error instanceof RegistryError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Registration failed' }, { status })
  }
}
