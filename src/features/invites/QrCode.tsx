import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** QR code drawn in the browser from the invite link (no CDN script). */
export function QrCode({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, { width: 352, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [text])
  return (
    <div className="qrw">
      <div className="qrb">{src ? <img src={src} width={176} height={176} alt={label} /> : <small>QR</small>}</div>
    </div>
  )
}
