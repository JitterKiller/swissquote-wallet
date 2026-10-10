import { HandleError, addContact } from '@/server/handles'

/** Allow another client (by handle) to resolve my handle when its visibility is "contacts". */
export async function POST(request: Request) {
  try {
    const { clientId, contactHandle } = (await request.json()) as { clientId?: string; contactHandle: string }
    return Response.json(await addContact(clientId, contactHandle))
  } catch (error) {
    const status = error instanceof HandleError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status })
  }
}
