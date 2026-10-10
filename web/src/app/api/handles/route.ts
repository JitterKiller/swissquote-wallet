import { HandleError, claimHandle, releaseHandle, setVisibility, type Visibility } from '@/server/handles'

/** Claim (POST), change visibility (PATCH) or release (DELETE) the caller's handle. MOCK auth. */
export async function POST(request: Request) {
  return run(async () => claimHandle(await request.json()))
}

export async function PATCH(request: Request) {
  return run(async () => {
    const { clientId, visibility } = (await request.json()) as { clientId?: string; visibility: Visibility }
    return setVisibility(clientId, visibility)
  })
}

export async function DELETE(request: Request) {
  return run(async () => releaseHandle(new URL(request.url).searchParams.get('clientId') ?? undefined))
}

async function run(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn())
  } catch (error) {
    if (!(error instanceof HandleError)) console.error(error)
    const status = error instanceof HandleError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Handle request failed' }, { status })
  }
}
