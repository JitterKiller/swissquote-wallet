import type { Metadata } from 'next'

import { DemoKeyView } from '@/components/views/DemoKeyView'

export const metadata: Metadata = { title: 'Demo security key' }

/** MOCK (ADR-043): the phone that plays the security key in the demo. Outside the app shell: it holds no wallet. */
export default function Page() {
  return <DemoKeyView />
}
