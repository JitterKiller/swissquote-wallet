import { ImageResponse } from 'next/og'

// The SQure mark for the iOS home screen (PDR-027). iOS rounds the corners itself.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#ff5f0f' }}>
        <div style={{ position: 'absolute', left: 96, top: 96, width: 62, height: 62, borderRadius: 8, background: '#171717' }} />
      </div>
    ),
    { ...size },
  )
}
