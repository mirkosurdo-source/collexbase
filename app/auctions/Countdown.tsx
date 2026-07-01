"use client"

import { useEffect, useState } from "react"

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Terminata"
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}g ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export default function Countdown({
  endsAt,
  onExpire,
  className,
}: {
  endsAt: string
  onExpire?: () => void
  className?: string
}) {
  const [remaining, setRemaining] = useState(() => new Date(endsAt).getTime() - Date.now())

  useEffect(() => {
    setRemaining(new Date(endsAt).getTime() - Date.now())
    const interval = setInterval(() => {
      const diff = new Date(endsAt).getTime() - Date.now()
      setRemaining(diff)
      if (diff <= 0) {
        clearInterval(interval)
        onExpire?.()
      }
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt])

  return <span className={className}>{formatRemaining(remaining)}</span>
}
