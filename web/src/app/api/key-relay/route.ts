import { connection } from 'next/server'

import { KeyRelayError, answerRequest, createPairing, createRequest, getPairing, getRequest, markSeen, registerKey } from '@/server/keyRelay'

/**
 * MOCK: the relay to the demo security key on another phone (ADR-043), standing in for a FIDO2 key's
 * USB or NFC link. GET `?code=` reads a pairing, `?proxy=` the key's waiting request, `?proxy=&id=` one
 * request for the wallet that sent it. POST `action`: pair, register, request, seen, answer.
 */
export async function GET(request: Request) {
  await connection()
  const params = new URL(request.url).searchParams
  return run(async () => {
    const code = params.get('code')
    if (code) return getPairing(code)
    const proxy = params.get('proxy')
    if (proxy) return { request: await getRequest(proxy, params.get('id')) }
    throw new KeyRelayError('Pass a code or a key')
  })
}

export async function POST(request: Request) {
  return run(async () => {
    const body = (await request.json()) as Record<string, unknown>
    switch (body.action) {
      case 'pair':
        return createPairing(body)
      case 'register':
        return registerKey(body)
      case 'request':
        return createRequest(body)
      case 'seen':
        return { request: await markSeen(body) }
      case 'answer':
        return { request: await answerRequest(body) }
      default:
        throw new KeyRelayError('Unknown action')
    }
  })
}

async function run(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn())
  } catch (error) {
    if (!(error instanceof KeyRelayError)) console.error(error)
    const status = error instanceof KeyRelayError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Key relay request failed' }, { status })
  }
}
