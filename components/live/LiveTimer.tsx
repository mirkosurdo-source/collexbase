"use client"

import { useEffect, useRef, useState } from "react"

function format(ms: number): string {
  if (ms <= 0) return "00:00"
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/**
 * A 1-second ticking countdown. Turns urgent (red) under `urgentSeconds` and
 * calls `onExpire` once when it reaches zero.
 */
export default function LiveTimer({
  endAt,
  urgentSeconds = 10,
  onExpire,
  className = "",
}: {
  endAt: string | null
  urgentSeconds?: number
  onExpire?: () => void
  className?: string
}) {
  const [remaining, setRemaining] = useState(() => (endAt ? new Date(endAt).getTime() - Date.now() : 0))
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    if (!endAt) return
    const tick = () => {
      const diff = new Date(endAt).getTime() - Date.now()
      setRemaining(diff)
      if (diff <= 0 && !firedRef.current) {
        firedRef.current = true
        onExpire?.()
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt])

  const urgent = remaining > 0 && remaining <= urgentSeconds * 1000
  return (
    <span
      className={`tabular-nums font-semibold ${urgent ? "text-red-600 dark:text-red-400" : ""} ${className}`}
      aria-live="polite"
    >
      {format(remaining)}
    </span>
  )
}
