import { RegistryError, createChallenge } from '@/server/registry'

/** Wallet registry (ADR-021): single-use challenge for the ownership statement. MOCK auth. */
export async function POST(request: Request) {
  try {
    return Response.json(await createChallenge(await request.json()))
  } catch (error) {
    const status = error instanceof RegistryError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Challenge failed' }, { status })
  }
}
