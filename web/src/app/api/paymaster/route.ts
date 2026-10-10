import { UPSTREAM_PAYMASTER_URL } from '@/lib/config'
import { decide, type RpcUserOperation } from '@/server/sponsorship'

/**
 * Swissquote paymaster (issue #23): an ERC-7677 JSON-RPC proxy in front of the upstream
 * paymaster. `pm_getPaymasterStubData` / `pm_getPaymasterData` go through the sponsorship
 * policy (server/sponsorship.ts); every other method is forwarded as is.
 */
type RpcRequest = { jsonrpc: '2.0'; id: number | string | null; method: string; params?: unknown[] }

const SPONSOR_METHODS = ['pm_getPaymasterStubData', 'pm_getPaymasterData']

async function handle(request: RpcRequest) {
  if (SPONSOR_METHODS.includes(request.method)) {
    const userOp = (request.params?.[0] ?? {}) as RpcUserOperation
    const decision = await decide(userOp, request.method === 'pm_getPaymasterData')
    if (!decision.sponsored) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32001, message: decision.message, data: { swissquote: true, reason: decision.reason } },
      }
    }
  }
  const upstream = await fetch(UPSTREAM_PAYMASTER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  })
  return upstream.json()
}

export async function POST(request: Request) {
  const body = (await request.json()) as RpcRequest | RpcRequest[]
  try {
    return Response.json(Array.isArray(body) ? await Promise.all(body.map(handle)) : await handle(body))
  } catch (error) {
    console.error(error)
    const id = Array.isArray(body) ? null : body.id
    return Response.json({ jsonrpc: '2.0', id, error: { code: -32603, message: 'Paymaster proxy error' } })
  }
}
