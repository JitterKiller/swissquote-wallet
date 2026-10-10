import { TransferError, withdrawToWallet } from '@/server/swissquoteAccount'

/** Swissquote account → wallet: on-chain USDC from the treasury to the client's Account (PDR-024). MOCK auth. */
export async function POST(request: Request) {
  try {
    return Response.json(await withdrawToWallet(await request.json()))
  } catch (error) {
    if (!(error instanceof TransferError)) console.error(error)
    const status = error instanceof TransferError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Transfer failed' }, { status })
  }
}
