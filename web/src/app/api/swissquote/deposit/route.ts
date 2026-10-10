import { TransferError, creditDeposit } from '@/server/swissquoteAccount'

/** Wallet → Swissquote account: credit a verified on-chain transfer from the client's registered wallet (PDR-024). MOCK auth. */
export async function POST(request: Request) {
  try {
    return Response.json(await creditDeposit(await request.json()))
  } catch (error) {
    if (!(error instanceof TransferError)) console.error(error)
    const status = error instanceof TransferError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Transfer failed' }, { status })
  }
}
