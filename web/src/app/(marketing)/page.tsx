import type { Metadata } from 'next'

import { LandingView } from '@/components/views/LandingView'

export const metadata: Metadata = {
  title: { absolute: 'SQure by Swissquote · Your keys. Swiss security.' },
  description: 'A self-custody wallet with no seed phrase and no network fees, one tap from your Swissquote account.',
}

export default function Page() {
  return <LandingView />
}
