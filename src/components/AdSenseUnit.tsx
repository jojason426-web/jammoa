import { useEffect } from 'react'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined

type AdSenseUnitProps = {
  slot?: string
  className?: string
  format?: 'auto' | 'fluid'
}

export function AdSenseUnit({ slot, className = '', format = 'auto' }: AdSenseUnitProps) {
  const enabled = Boolean(adsenseClient && slot)

  useEffect(() => {
    if (!enabled) return

    try {
      const scriptSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`
      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`)

      if (!existingScript) {
        const script = document.createElement('script')
        script.async = true
        script.src = scriptSrc
        script.crossOrigin = 'anonymous'
        document.head.appendChild(script)
      }

      window.adsbygoogle = window.adsbygoogle ?? []
      window.adsbygoogle.push({})
    } catch {
      // Ad blockers or review crawlers may block the request; content should still render.
    }
  }, [enabled, slot])

  if (!enabled) {
    return null
  }

  return (
    <aside className={`adsense-unit ${className}`} aria-label="광고">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adsenseClient}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  )
}
