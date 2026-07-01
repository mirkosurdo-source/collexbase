"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

type MatchKind = "marketplace" | "auction" | "trade"

interface MatchResult {
  matched: boolean
  label?: string
  reasons?: string[]
}

/**
 * Blocco 24 — shows a CollexSpark "in your wishlist" badge when the given
 * object matches one of the current user's wishlist entries. Renders nothing
 * for guests or non-matches, so it is safe to drop onto any detail page.
 */
export default function WishlistMatchBadge({
  kind,
  name,
  category,
  price,
  rarity,
  className = "",
}: {
  kind: MatchKind
  name: string
  category?: string
  price?: number
  rarity?: string
  className?: string
}) {
  const [result, setResult] = useState<MatchResult | null>(null)

  useEffect(() => {
    let active = true
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token || !name) return

    fetch("/api/wishlist/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, name, category, price, rarity }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.matched) setResult(data)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [kind, name, category, price, rarity])

  if (!result?.matched) return null

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full bg-spark px-3 py-1.5 text-sm font-semibold text-spark-foreground shadow-sm ${className}`}
      title={result.reasons?.join(" · ")}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span>{result.label ?? "Nella tua wishlist"}</span>
    </div>
  )
}
