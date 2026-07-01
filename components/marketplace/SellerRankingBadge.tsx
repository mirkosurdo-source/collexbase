"use client"

import { useEffect, useState } from "react"

type Ranking = {
  sellerId: string
  score: number
  tier: string
  ordersCompleted: number
  rating: number
  ratingCount: number
  last30DaysSales: number
}

const TIER_STYLE: Record<string, string> = {
  "Elite Seller": "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  "Power Seller": "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  "Top Seller": "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  "Trusted Seller": "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
}

export default function SellerRankingBadge({
  sellerId,
  className = "",
}: {
  sellerId: string
  className?: string
}) {
  const [rank, setRank] = useState<Ranking | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/marketplace/seller-ranking/${sellerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.success) setRank(d.ranking)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [sellerId])

  if (!rank || !rank.tier) return null

  const style = TIER_STYLE[rank.tier] || "bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700"

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>
        {rank.tier}
        <span className="opacity-70">· {rank.score}/100</span>
      </span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {rank.rating > 0 ? `${rank.rating.toFixed(1)}★ (${rank.ratingCount})` : "Nessuna recensione"}
        {rank.ordersCompleted > 0 ? ` · ${rank.ordersCompleted} vendite` : ""}
      </span>
    </div>
  )
}
